/**
 * Restore de arquivo (Fase 2, escopo estreito) — devolve UM objeto que
 * sumiu (apagado sem querer, ou corrompido) a partir da cópia já
 * mantida no bucket de backup. Nunca cria estrutura nova nem mexe em
 * outro objeto — restore de tenant inteiro ou do banco completo ficam
 * de fora dessa fase de propósito (sobrescrevem dado vivo, exigem um
 * ambiente de staging que não existe ainda — ver
 * docs/backup-disaster-recovery.md).
 */

import { createAdminClient } from '@/lib/supabase/server'
import { getBackupObject } from './r2-backup-client'
import { putRawObject } from '@/lib/storage/providers/r2'

export type RestoreCurrentStatus = 'active' | 'deleted' | 'missing'

/** Decisão pura, sem I/O — só prossegue direto quando o objeto não
 *  existe mais em produção (ou está soft-deleted). Se ainda estiver
 *  ativo, só com `overwrite=true` explícito (o client sempre confirma
 *  antes de mandar isso). Extraída à parte pra ser testável sem mockar
 *  banco/R2. */
export function canRestore(currentStatus: RestoreCurrentStatus, overwrite: boolean): boolean {
  if (currentStatus === 'active') return overwrite
  return true
}

export type RestoreObjectInput = {
  organizationId: string
  objectId: string // id da linha em storage_objects (viva ou soft-deleted)
  userId: string
  overwrite?: boolean
}

export type RestoreObjectResult =
  | { ok: true }
  | { ok: false; error: string; needsOverwriteConfirmation?: boolean }

export async function restoreObject(input: RestoreObjectInput): Promise<RestoreObjectResult> {
  const admin = createAdminClient()

  const { data: row } = await admin
    .from('storage_objects')
    .select('*')
    .eq('id', input.objectId)
    .eq('organization_id', input.organizationId)
    .maybeSingle()

  if (!row) return { ok: false, error: 'Objeto não encontrado (linha de metadado inexistente — fora do escopo desse restore, ver limitação documentada).' }

  const currentStatus: RestoreCurrentStatus = row.status === 'active' ? 'active' : 'deleted'
  if (!canRestore(currentStatus, !!input.overwrite)) {
    return { ok: false, error: 'Objeto ainda está ativo em produção — restaurar sobrescreveria a versão atual. Confirme explicitamente pra prosseguir.', needsOverwriteConfirmation: true }
  }

  const backupKey = `tenants/${input.organizationId}/storage/${row.storage_key}`
  let bytes: Buffer
  try {
    bytes = await getBackupObject(backupKey)
  } catch (e: any) {
    return { ok: false, error: `Cópia de backup não encontrada (${e?.message || 'erro desconhecido'}). Só é possível restaurar o que já passou por um backup de storage bem-sucedido.` }
  }

  try {
    await putRawObject(row.bucket, row.storage_key, bytes, row.mime_type || 'application/octet-stream')
  } catch (e: any) {
    return { ok: false, error: `Falha ao escrever de volta na produção: ${e?.message || 'erro desconhecido'}` }
  }

  const { error: updateError } = await admin
    .from('storage_objects')
    .update({ status: 'active' })
    .eq('id', input.objectId)
  if (updateError) return { ok: false, error: `Objeto restaurado no R2, mas falhou ao atualizar o metadado: ${updateError.message}` }

  await admin.from('backup_audit_log').insert({
    event: 'object_restore_completed',
    user_id: input.userId,
    organization_id: input.organizationId,
    metadata: { object_id: input.objectId, storage_key: row.storage_key, overwrote_active: currentStatus === 'active' },
  })

  return { ok: true }
}
