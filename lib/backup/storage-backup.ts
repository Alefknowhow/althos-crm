/**
 * Backup incremental do storage — cobre tanto os objetos já migrados
 * pro R2 (`storage_objects`) quanto os buckets legados do Supabase
 * Storage ainda em uso (modelo híbrido — ver lib/storage/index.ts).
 *
 * Incremental: só processa `storage_objects` cujo `updated_at` é mais
 * recente que o último backup de storage bem-sucedido (cursor simples
 * via `backup_runs`). Le a produção com o client normal (StorageService
 * — read-only aqui) e escreve no bucket de backup com o client isolado
 * (lib/backup/r2-backup-client.ts) — download+upload em vez de cópia
 * server-side entre buckets, deliberado: a credencial de backup é
 * escopada SÓ ao bucket de backup (least privilege), então não tem
 * permissão de leitura no bucket de produção pra uma CopyObject
 * funcionar. R2 não cobra egress, então esse download+upload não tem
 * custo extra de rede — só tempo de CPU.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { StorageService } from '@/lib/storage'
import { putBackupObject, headBackupObject } from './r2-backup-client'
import { sha256 } from './crypto'

/** Os 12 buckets legados do Supabase Storage (pré-R2) — arquivos
 *  enviados antes da Storage Service existir nunca ganharam uma linha
 *  em `storage_objects` (só uploads NOVOS, pós-migração, são
 *  registrados lá), então precisam de um caminho de backup à parte,
 *  listando o bucket diretamente. Lista replicada do comentário em
 *  supabase/migrations/0156_storage_objects.sql — atualizar aqui se um
 *  bucket legado novo aparecer (não há como descobrir dinamicamente via
 *  API pública do Supabase quais buckets existem sem a service role
 *  listar o projeto inteiro, o que é mais arriscado que manter a lista
 *  explícita). */
export const LEGACY_SUPABASE_BUCKETS = [
  'whatsapp-media', 'instagram-media', 'form-assets', 'contato-avatars',
  'financial-attachments', 'budget-documents', 'customer-documents',
  'org-logos', 'whatsapp-assets', 'email-assets', 'medif-templates', 'sale-contracts',
] as const

const MAX_LIST_DEPTH = 4

export type StorageBackupResult = {
  objectsCopied: number
  bytesCopied: number
  tenantIds: Set<string>
}

/** Copia um lote de `storage_objects` pro bucket de backup, registrando
 *  o ETag em `backup_object_state` pra auditoria/futuro restore. Não
 *  tenta reconstruir o objeto se `status='deleted'` — a cópia já feita
 *  antes da exclusão continua no bucket de backup até expirar pela
 *  retenção (ver lib/backup/retention.ts). */
export async function backupStorageObjects(sinceISO: string | null): Promise<StorageBackupResult> {
  const admin = createAdminClient()
  let query = admin
    .from('storage_objects')
    .select('id, organization_id, storage_provider, bucket, storage_key, filename, updated_at, status')
    .eq('status', 'active')
    .order('updated_at', { ascending: true })
  if (sinceISO) query = query.gt('updated_at', sinceISO)

  const { data: rows, error } = await query
  if (error) throw new Error(`Falha ao listar storage_objects: ${error.message}`)

  const result: StorageBackupResult = { objectsCopied: 0, bytesCopied: 0, tenantIds: new Set() }
  if (!rows || rows.length === 0) return result

  for (const row of rows) {
    try {
      const bytes = await StorageService.download({
        provider: row.storage_provider as any,
        bucket: row.bucket,
        storageKey: row.storage_key,
      })
      const destKey = `tenants/${row.organization_id}/storage/${row.storage_key}`
      await putBackupObject(destKey, bytes, 'application/octet-stream')

      const checksum = sha256(bytes)
      await admin.from('backup_object_state').upsert(
        {
          bucket: 'backup',
          storage_key: destKey,
          organization_id: row.organization_id,
          etag: checksum,
          backed_up_at: new Date().toISOString(),
        },
        { onConflict: 'bucket,storage_key' },
      )

      result.objectsCopied++
      result.bytesCopied += bytes.byteLength
      result.tenantIds.add(row.organization_id)
    } catch (e: any) {
      console.error(`[backup] falha ao copiar objeto ${row.id} (${row.storage_key}):`, e?.message)
      // Um objeto com falha não derruba o run inteiro — o próximo tick
      // (mesmo `sinceISO`, já que esse objeto não teve `updated_at`
      // avançado) tenta de novo.
    }
  }

  return result
}

/** Lista recursivamente (até MAX_LIST_DEPTH) os caminhos de arquivo de
 *  um bucket do Supabase Storage — a API só lista uma pasta por vez, sem
 *  recursão nativa. */
async function listAllPaths(admin: ReturnType<typeof createAdminClient>, bucket: string, prefix = '', depth = 0): Promise<string[]> {
  if (depth > MAX_LIST_DEPTH) return []
  const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000 })
  if (error || !data) return []

  const paths: string[] = []
  for (const entry of data) {
    const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name
    // Pasta: Supabase Storage retorna `id: null` pra "pastas" virtuais.
    if (entry.id === null) {
      paths.push(...await listAllPaths(admin, bucket, fullPath, depth + 1))
    } else {
      paths.push(fullPath)
    }
  }
  return paths
}

/** Backup dos 12 buckets legados do Supabase Storage — não-incremental
 *  de verdade (não há `updated_at` fácil de comparar aqui), mas barato
 *  o bastante pra este estágio do projeto: pula qualquer objeto que já
 *  tenha uma entrada em `backup_object_state` com a mesma key (checagem
 *  de existência via HEAD no bucket de backup, não recopia). */
export async function backupLegacySupabaseBuckets(): Promise<StorageBackupResult> {
  const admin = createAdminClient()
  const result: StorageBackupResult = { objectsCopied: 0, bytesCopied: 0, tenantIds: new Set() }

  for (const bucket of LEGACY_SUPABASE_BUCKETS) {
    const paths = await listAllPaths(admin, bucket)
    for (const path of paths) {
      const destKey = `legacy-supabase/${bucket}/${path}`
      const existing = await headBackupObject(destKey)
      if (existing) continue // já copiado em run anterior — bucket legado é imutável na prática (upsert:false nos uploads antigos)

      try {
        const { data, error } = await admin.storage.from(bucket).download(path)
        if (error || !data) { console.error(`[backup] falha ao baixar ${bucket}/${path}:`, error?.message); continue }
        const bytes = Buffer.from(await data.arrayBuffer())
        await putBackupObject(destKey, bytes, data.type || 'application/octet-stream')

        // orgId costuma ser o primeiro segmento do path (convenção dos
        // buckets legados) — best-effort, só pra contagem de tenants.
        const orgId = path.split('/')[0]
        result.tenantIds.add(orgId)
        result.objectsCopied++
        result.bytesCopied += bytes.byteLength
      } catch (e: any) {
        console.error(`[backup] falha ao processar ${bucket}/${path}:`, e?.message)
      }
    }
  }

  return result
}
