'use server'

/**
 * Storage Service upload actions: direct upload, presigned-URL upload flow,
 * and registering the resulting metadata. Split out of actions/storage.ts.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { StorageService, type StorageCategory } from '@/lib/storage'

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024 // 20MB — mesmo teto já usado pelos uploads existentes (whatsapp-media, instagram-media)

const ALLOWED_MIME_BY_CATEGORY: Record<StorageCategory, string[]> = {
  whatsapp: ['image/jpeg', 'image/png', 'image/webp', 'audio/ogg', 'audio/webm', 'audio/opus', 'audio/mpeg', 'audio/mp4', 'audio/aac', 'video/mp4', 'video/3gpp', 'application/pdf'],
  instagram: ['image/jpeg', 'image/png', 'image/webp', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/aac'],
  attachments: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'],
  documents: ['application/pdf', 'image/jpeg', 'image/png'],
  avatars: ['image/jpeg', 'image/png', 'image/webp'],
  exports: ['text/csv', 'application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
}

/**
 * Registra no banco um objeto já enviado pro provider (upload feito por
 * `uploadFile` abaixo, ou por um fluxo de presigned URL que confirma
 * depois). Nunca chame isso sem o upload ter de fato acontecido — isso
 * criaria um registro "fantasma" apontando pra um arquivo inexistente.
 */
async function registerObject(params: {
  organizationId: string
  userId: string | null
  category: StorageCategory
  conversationId?: string | null
  messageId?: string | null
  provider: 'supabase' | 'r2' | 's3' | 'b2'
  bucket: string
  storageKey: string
  filename?: string | null
  mimeType: string
  sizeBytes: number
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('storage_objects')
    .insert({
      organization_id: params.organizationId,
      user_id: params.userId,
      conversation_id: params.conversationId ?? null,
      message_id: params.messageId ?? null,
      storage_provider: params.provider,
      bucket: params.bucket,
      storage_key: params.storageKey,
      filename: params.filename ?? null,
      mime_type: params.mimeType,
      size_bytes: params.sizeBytes,
    })
    .select('id')
    .single()
  if (error || !data) return { ok: false, error: error?.message || 'Falha ao registrar metadados do arquivo.' }
  return { ok: true, id: data.id }
}

/**
 * Upload direto (arquivo pequeno passando pelo servidor) — pra arquivo
 * grande, prefira `createUploadUrl` + upload direto do browser pro R2
 * (Fase 6 do plano), que não passa pela função serverless da Vercel.
 */
export async function uploadFile(
  orgSlug: string,
  input: {
    category: StorageCategory
    scopeId?: string | null
    conversationId?: string | null
    messageId?: string | null
    filename: string
    contentType: string
    base64: string
  },
): Promise<{ ok: true; objectId: string; storageKey: string } | { ok: false; error: string }> {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)

  const allowed = ALLOWED_MIME_BY_CATEGORY[input.category]
  if (!allowed?.includes(input.contentType)) {
    return { ok: false, error: `Tipo de arquivo não permitido pra categoria "${input.category}": ${input.contentType}` }
  }

  const buffer = Buffer.from(input.base64, 'base64')
  if (buffer.byteLength === 0) return { ok: false, error: 'Arquivo vazio.' }
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    return { ok: false, error: `Arquivo muito grande (máx ${MAX_UPLOAD_BYTES / 1024 / 1024}MB).` }
  }

  const fileId = crypto.randomUUID()
  let result
  try {
    result = await StorageService.upload({
      organizationId: org.id,
      category: input.category,
      scopeId: input.scopeId ?? null,
      fileId,
      body: buffer,
      contentType: input.contentType,
      filename: input.filename,
    })
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Falha ao enviar arquivo.' }
  }

  const registered = await registerObject({
    organizationId: org.id,
    userId: user.id,
    category: input.category,
    conversationId: input.conversationId,
    messageId: input.messageId,
    provider: result.provider,
    bucket: result.bucket,
    storageKey: result.storageKey,
    filename: input.filename,
    mimeType: input.contentType,
    sizeBytes: result.size,
  })
  if (!registered.ok) return registered

  return { ok: true, objectId: registered.id, storageKey: result.storageKey }
}

/**
 * Presigned upload URL (Fase 6) — o browser sobe o arquivo direto pro
 * R2, sem passar pela função serverless. Depois do upload, o client
 * chama `confirmPresignedUpload` pra registrar os metadados.
 */
export async function createPresignedUploadUrl(
  orgSlug: string,
  input: { category: StorageCategory; scopeId?: string | null; filename: string; contentType: string },
): Promise<{ ok: true; uploadUrl: string; objectKey: string } | { ok: false; error: string }> {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)

  const allowed = ALLOWED_MIME_BY_CATEGORY[input.category]
  if (!allowed?.includes(input.contentType)) {
    return { ok: false, error: `Tipo de arquivo não permitido pra categoria "${input.category}": ${input.contentType}` }
  }

  const fileId = crypto.randomUUID()
  try {
    const { uploadUrl, storageKey } = await StorageService.createUploadUrl({
      organizationId: org.id,
      category: input.category,
      scopeId: input.scopeId ?? null,
      fileId,
      contentType: input.contentType,
      filename: input.filename,
    })
    return { ok: true, uploadUrl, objectKey: storageKey }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Falha ao gerar URL de upload.' }
  }
}

/** Confirma que um upload via presigned URL terminou e registra o
 *  metadado — chamar só depois do PUT direto pro R2 ter retornado 200. */
export async function confirmPresignedUpload(
  orgSlug: string,
  input: {
    objectKey: string
    category: StorageCategory
    conversationId?: string | null
    messageId?: string | null
    filename: string
    contentType: string
    sizeBytes: number
  },
): Promise<{ ok: true; objectId: string } | { ok: false; error: string }> {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)

  // A key precisa começar com tenants/{org.id}/ — nunca confiamos numa
  // key arbitrária vinda do client (Fase 5: "o backend deve determinar o
  // tenant autorizado", nunca só validar o que foi enviado).
  const expectedPrefix = `tenants/${org.id}/`
  if (!input.objectKey.startsWith(expectedPrefix)) {
    return { ok: false, error: 'Chave de objeto não pertence a esta organização.' }
  }

  const registered = await registerObject({
    organizationId: org.id,
    userId: user.id,
    category: input.category,
    conversationId: input.conversationId,
    messageId: input.messageId,
    provider: 'r2',
    bucket: process.env.R2_BUCKET_NAME || '',
    storageKey: input.objectKey,
    filename: input.filename,
    mimeType: input.contentType,
    sizeBytes: input.sizeBytes,
  })
  if (!registered.ok) return registered
  return { ok: true, objectId: registered.id }
}
