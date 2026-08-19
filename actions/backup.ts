'use server'

/**
 * Leitura pro dashboard de backup (/super-admin/backups) — Fase 1 é
 * read-only, sem ação de restore/apagar. Mesmo padrão de gate de
 * super-admin já usado em actions/super-admin.ts (isSuperAdmin()).
 */

import { isSuperAdmin } from '@/lib/supabase/types'
import { createAdminClient } from '@/lib/supabase/server'

export type BackupRunRow = {
  id: string
  type: 'database' | 'storage'
  status: 'running' | 'success' | 'failed' | 'invalid'
  started_at: string
  completed_at: string | null
  duration_ms: number | null
  manifest_key: string | null
  database_size_bytes: number | null
  storage_object_count: number | null
  storage_bytes: number | null
  checksum: string | null
  error_message: string | null
  triggered_by: 'cron' | 'manual'
}

export async function listBackupRuns(limit = 30): Promise<BackupRunRow[]> {
  if (!(await isSuperAdmin())) return []
  const admin = createAdminClient()
  const { data } = await admin
    .from('backup_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit)
  return (data as BackupRunRow[]) ?? []
}

export type BackupStatusSummary = {
  lastDatabaseRun: BackupRunRow | null
  lastStorageRun: BackupRunRow | null
}

export async function getBackupStatus(): Promise<BackupStatusSummary | null> {
  if (!(await isSuperAdmin())) return null
  const admin = createAdminClient()

  const [{ data: lastDb }, { data: lastStorage }] = await Promise.all([
    admin.from('backup_runs').select('*').eq('type', 'database').order('started_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('backup_runs').select('*').eq('type', 'storage').order('started_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  return {
    lastDatabaseRun: (lastDb as BackupRunRow) ?? null,
    lastStorageRun: (lastStorage as BackupRunRow) ?? null,
  }
}
