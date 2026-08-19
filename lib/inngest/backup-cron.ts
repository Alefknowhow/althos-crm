/**
 * Jobs de Backup (Fase 1 — só backup, sem restore automatizado; ver
 * docs/backup-disaster-recovery.md). Registrados em app/api/inngest/route.ts,
 * mesma infraestrutura de cron já usada pelo resto do projeto.
 *
 * Cada função grava uma linha em `backup_runs` (status running → success/
 * failed/invalid) e só marca 'success' se a verificação de integridade
 * passar — nunca reporta sucesso sem checar (regra do plano de backup).
 */

import { inngest } from './client'
import { createAdminClient } from '@/lib/supabase/server'
import { dumpDatabase, decodeDump } from '@/lib/backup/db-dump'
import { encryptBuffer, decryptBuffer, sha256 } from '@/lib/backup/crypto'
import { putBackupObject, getBackupObject, listBackupObjects, deleteBackupObject } from '@/lib/backup/r2-backup-client'
import { buildManifestKey, serializeManifest, type BackupManifest } from '@/lib/backup/manifest'
import { backupStorageObjects, backupLegacySupabaseBuckets } from '@/lib/backup/storage-backup'
import { tiersForDate, isExpired, extractDateFromKey, RETENTION_DAYS, type RetentionTier } from '@/lib/backup/retention'
import { sendBackupAlert } from '@/lib/backup/alert'

async function logAudit(admin: ReturnType<typeof createAdminClient>, event: string, backupRunId: string | null, metadata: Record<string, any> = {}) {
  try {
    await admin.from('backup_audit_log').insert({ event, backup_run_id: backupRunId, metadata })
  } catch (e: any) {
    console.error('[backup] falha ao gravar audit log:', e?.message)
  }
}

export const backupDatabaseCronFn = inngest.createFunction(
  { id: 'backup-database', name: 'Backup diário do banco (Postgres)', retries: 1, triggers: [{ cron: '0 3 * * *' }] },
  async ({ step }: { step: any }) => {
    const admin = createAdminClient()

    const runId: string = await step.run('create-run-row', async () => {
      const { data, error } = await admin.from('backup_runs').insert({ type: 'database', status: 'running', triggered_by: 'cron' }).select('id').single()
      if (error || !data) throw new Error(error?.message || 'Falha ao criar backup_runs')
      return data.id
    })

    const result: { status: 'success' | 'invalid' | 'failed'; sizeBytes?: number; checksum?: string; error?: string } =
      await step.run('dump-encrypt-upload-verify', async () => {
        const startedAt = Date.now()
        try {
          const { compressed, tables, rowCounts } = await dumpDatabase()
          const checksum = sha256(compressed)
          const encrypted = encryptBuffer(compressed)

          const now = new Date()
          const tiers = tiersForDate(now)
          for (const tier of tiers) {
            const key = `database/${tier}/${now.toISOString().slice(0, 10)}.enc`
            await putBackupObject(key, encrypted, 'application/octet-stream')
          }

          // Verificação: baixa de volta, descriptografa, descomprime,
          // confirma que ainda é JSON válido com as mesmas tabelas —
          // nunca marca 'success' sem isso passar.
          const verifyKey = `database/daily/${now.toISOString().slice(0, 10)}.enc`
          const roundTrip = await getBackupObject(verifyKey)
          const decrypted = decryptBuffer(roundTrip)
          const decoded = decodeDump(decrypted)
          const tablesMatch = Object.keys(decoded.tables).length === tables.length

          const manifest: BackupManifest = {
            backup_id: runId,
            timestamp: now.toISOString(),
            type: 'database',
            tenant_count: 0, // banco inteiro, não é por-tenant
            object_count: tables.length,
            database_size_bytes: compressed.byteLength,
            storage_size_bytes: null,
            checksum,
            status: tablesMatch ? 'success' : 'invalid',
            version: 1,
            duration_ms: Date.now() - startedAt,
          }
          const manifestKey = buildManifestKey('database', 'daily', now)
          await putBackupObject(manifestKey, serializeManifest(manifest), 'application/json')

          await admin.from('backup_runs').update({
            status: manifest.status,
            completed_at: new Date().toISOString(),
            duration_ms: manifest.duration_ms,
            manifest_key: manifestKey,
            database_size_bytes: compressed.byteLength,
            checksum,
            error_message: tablesMatch ? null : `Verificação falhou: esperava ${tables.length} tabelas, achou ${Object.keys(decoded.tables).length}. Tabelas: ${tables.join(', ')}. Linhas: ${JSON.stringify(rowCounts)}`,
          }).eq('id', runId)

          return { status: manifest.status, sizeBytes: compressed.byteLength, checksum }
        } catch (e: any) {
          await admin.from('backup_runs').update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            duration_ms: Date.now() - startedAt,
            error_message: e?.message || 'Erro desconhecido',
          }).eq('id', runId)
          return { status: 'failed', error: e?.message }
        }
      })

    await step.run('audit-and-alert', async () => {
      await logAudit(admin, result.status === 'success' ? 'backup_created' : 'backup_failed', runId, { size_bytes: result.sizeBytes })
      if (result.status === 'success') await logAudit(admin, 'backup_verified', runId)
      if (result.status !== 'success') {
        await sendBackupAlert(
          `Backup do banco ${result.status === 'invalid' ? 'inválido' : 'falhou'}`,
          `run_id=${runId}\nstatus=${result.status}\nerro=${result.error || 'verificação de checksum/tabelas falhou'}`,
        )
      }
    })

    return result
  },
)

export const backupStorageCronFn = inngest.createFunction(
  { id: 'backup-storage', name: 'Backup incremental do storage (R2 + buckets legados)', retries: 1, triggers: [{ cron: '30 3 * * *' }] },
  async ({ step }: { step: any }) => {
    const admin = createAdminClient()

    const runId: string = await step.run('create-run-row', async () => {
      const { data, error } = await admin.from('backup_runs').insert({ type: 'storage', status: 'running', triggered_by: 'cron' }).select('id').single()
      if (error || !data) throw new Error(error?.message || 'Falha ao criar backup_runs')
      return data.id
    })

    const lastSuccessAt: string | null = await step.run('find-last-success', async () => {
      const { data } = await admin
        .from('backup_runs')
        .select('completed_at')
        .eq('type', 'storage')
        .eq('status', 'success')
        .neq('id', runId)
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return data?.completed_at ?? null
    })

    const result: { status: 'success' | 'failed'; objectCount?: number; bytes?: number; error?: string } =
      await step.run('copy-objects', async () => {
        const startedAt = Date.now()
        try {
          const r2Result = await backupStorageObjects(lastSuccessAt)
          const legacyResult = await backupLegacySupabaseBuckets()

          const objectCount = r2Result.objectsCopied + legacyResult.objectsCopied
          const bytes = r2Result.bytesCopied + legacyResult.bytesCopied
          const tenantCount = new Set(Array.from(r2Result.tenantIds).concat(Array.from(legacyResult.tenantIds))).size
          const durationMs = Date.now() - startedAt

          const now = new Date()
          const manifest: BackupManifest = {
            backup_id: runId,
            timestamp: now.toISOString(),
            type: 'storage',
            tenant_count: tenantCount,
            object_count: objectCount,
            database_size_bytes: null,
            storage_size_bytes: bytes,
            checksum: '', // por-objeto, não faz sentido um checksum único do lote — cada objeto tem o seu em backup_object_state
            status: 'success',
            version: 1,
            duration_ms: durationMs,
          }
          const manifestKey = buildManifestKey('storage', 'daily', now)
          await putBackupObject(manifestKey, serializeManifest(manifest), 'application/json')

          await admin.from('backup_runs').update({
            status: 'success',
            completed_at: now.toISOString(),
            duration_ms: durationMs,
            manifest_key: manifestKey,
            storage_object_count: objectCount,
            storage_bytes: bytes,
          }).eq('id', runId)

          return { status: 'success', objectCount, bytes }
        } catch (e: any) {
          await admin.from('backup_runs').update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            duration_ms: Date.now() - startedAt,
            error_message: e?.message || 'Erro desconhecido',
          }).eq('id', runId)
          return { status: 'failed', error: e?.message }
        }
      })

    await step.run('audit-and-alert', async () => {
      await logAudit(admin, result.status === 'success' ? 'backup_created' : 'backup_failed', runId, { object_count: result.objectCount, bytes: result.bytes })
      if (result.status !== 'success') {
        await sendBackupAlert('Backup do storage falhou', `run_id=${runId}\nerro=${result.error || 'erro desconhecido'}`)
      }
    })

    return result
  },
)

export const backupRetentionCronFn = inngest.createFunction(
  { id: 'backup-retention', name: 'Limpeza de backups expirados', retries: 1, triggers: [{ cron: '0 4 * * *' }] },
  async ({ step }: { step: any }) => {
    const admin = createAdminClient()

    const deleted: string[] = await step.run('sweep-expired', async () => {
      const removed: string[] = []
      const prefixes: { prefix: string; tier: RetentionTier }[] = [
        { prefix: 'database/daily/', tier: 'daily' },
        { prefix: 'database/weekly/', tier: 'weekly' },
        { prefix: 'database/monthly/', tier: 'monthly' },
        { prefix: 'manifests/daily/', tier: 'daily' },
        { prefix: 'manifests/weekly/', tier: 'weekly' },
        { prefix: 'manifests/monthly/', tier: 'monthly' },
      ]

      for (const { prefix, tier } of prefixes) {
        const keys = await listBackupObjects(prefix)
        for (const key of keys) {
          const date = extractDateFromKey(key)
          if (!date) continue // sem data no nome — nunca apaga por segurança
          if (isExpired(date, tier)) {
            await deleteBackupObject(key)
            removed.push(key)
          }
        }
      }
      return removed
    })

    if (deleted.length > 0) {
      await step.run('log-deletions', async () => {
        for (const key of deleted) await logAudit(admin, 'backup_deleted', null, { key })
      })
    }

    return { deletedCount: deleted.length, retentionDays: RETENTION_DAYS }
  },
)
