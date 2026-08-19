'use server'

/**
 * Backup/restore pro dashboard (/super-admin/backups). Fase 1 (leitura)
 * + Fase 2 (restore de arquivo, escopo estreito — ver
 * lib/backup/restore-object.ts). Mesmo padrão de gate de super-admin já
 * usado em actions/super-admin.ts (isSuperAdmin()).
 */

import { revalidatePath } from 'next/cache'
import { isSuperAdmin, getUser } from '@/lib/supabase/types'
import { createAdminClient } from '@/lib/supabase/server'
import { restoreObject } from '@/lib/backup/restore-object'

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

// ── Fase 2: restore de arquivo (escopo estreito, ver lib/backup/restore-object.ts) ──

export type DeletedObjectRow = {
  id: string
  storage_key: string
  filename: string | null
  mime_type: string | null
  size_bytes: number | null
  updated_at: string
}

async function resolveOrgId(orgSlug: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin.from('organizations').select('id').eq('slug', orgSlug).maybeSingle()
  return data?.id ?? null
}

export async function listDeletedObjects(orgSlug: string): Promise<DeletedObjectRow[]> {
  if (!(await isSuperAdmin())) return []
  const orgId = await resolveOrgId(orgSlug)
  if (!orgId) return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('storage_objects')
    .select('id, storage_key, filename, mime_type, size_bytes, updated_at')
    .eq('organization_id', orgId)
    .eq('status', 'deleted')
    .order('updated_at', { ascending: false })
    .limit(50)
  return (data as DeletedObjectRow[]) ?? []
}

export async function restoreDeletedObject(
  orgSlug: string,
  objectId: string,
  overwrite = false,
): Promise<{ ok: true } | { ok: false; error: string; needsOverwriteConfirmation?: boolean }> {
  if (!(await isSuperAdmin())) return { ok: false, error: 'Não autorizado' }
  const user = await getUser()
  if (!user) return { ok: false, error: 'Não autenticado' }
  const orgId = await resolveOrgId(orgSlug)
  if (!orgId) return { ok: false, error: 'Organização não encontrada' }

  const result = await restoreObject({ organizationId: orgId, objectId, userId: user.id, overwrite })
  if (result.ok) revalidatePath('/super-admin/backups')
  return result
}
