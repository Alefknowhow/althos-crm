/**
 * Upload de sistema — pra contextos SEM usuário autenticado (webhook do
 * WhatsApp/Instagram, jobs do Inngest). `actions/storage.ts` não serve
 * aqui porque toda função lá chama `requireAuth()`/`getCurrentOrganization`
 * — o webhook já resolveu (e confia) o `organizationId` sozinho (via
 * phone_number_id / conta do Instagram), então essa camada pula a
 * resolução de sessão e usa o admin client diretamente, igual o resto
 * do webhook já faz.
 *
 * Sempre grava a signed URL já pronta (`cached_signed_url`) no INSERT —
 * decisão da migração de mídia do WhatsApp/Instagram pra R2: mensagens
 * novas chegam no client via Supabase Realtime (linha crua do banco,
 * sem passar pelo servidor), então a URL precisa estar pronta pra uso
 * imediato. Ver actions/storage.ts::resolveSignedUrl pro caso
 * equivalente em contexto autenticado (que cacheia sob demanda, não no
 * write) — aqui cacheamos direto porque é a primeira e única leitura
 * conhecida no momento do write.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { StorageService, SIGNED_URL_TTL_SECONDS } from './index'
import type { StorageCategory } from './types'

export async function uploadSystemFile(input: {
  organizationId: string
  category: StorageCategory
  scopeId?: string | null
  conversationId?: string | null
  filename: string
  contentType: string
  body: Buffer
}): Promise<{ ok: true; objectId: string; url: string } | { ok: false; error: string }> {
  const fileId = crypto.randomUUID()
  let result
  try {
    result = await StorageService.upload({
      organizationId: input.organizationId,
      category: input.category,
      scopeId: input.scopeId ?? null,
      fileId,
      body: input.body,
      contentType: input.contentType,
      filename: input.filename,
    })
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Falha ao enviar arquivo.' }
  }

  const ref = { provider: result.provider, bucket: result.bucket, storageKey: result.storageKey }
  let url: string
  try {
    url = await StorageService.getSignedUrl(ref, { expiresInSeconds: SIGNED_URL_TTL_SECONDS, downloadFilename: null })
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Falha ao assinar URL.' }
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('storage_objects')
    .insert({
      organization_id: input.organizationId,
      conversation_id: input.conversationId ?? null,
      storage_provider: result.provider,
      bucket: result.bucket,
      storage_key: result.storageKey,
      filename: input.filename,
      mime_type: input.contentType,
      size_bytes: result.size,
      cached_signed_url: url,
      cached_signed_url_expires_at: new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
    })
    .select('id')
    .single()
  if (error || !data) return { ok: false, error: error?.message || 'Falha ao registrar metadados do arquivo.' }

  return { ok: true, objectId: data.id, url }
}
