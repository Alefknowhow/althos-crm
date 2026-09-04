'use server'

/**
 * Camada de Server Actions sobre a Storage Service (lib/storage/) —
 * autenticação, resolução de tenant e autorização ficam aqui; a
 * StorageService em si não sabe o que é um usuário ou uma organização
 * (Fase 5 do plano: "o backend deve determinar o tenant autorizado",
 * nunca confiar no que o client manda).
 *
 * Escopo desta fase: a camada existe e é utilizável, mas nenhum fluxo
 * de produção (WhatsApp, Instagram, avatares, anexos) foi migrado pra
 * cá ainda — isso é deliberado (Fase 9, migração gradual). Features
 * específicas continuam com seus próprios uploads pros buckets legados
 * do Supabase Storage até serem adotadas aqui uma de cada vez.
 *
 * Este arquivo não define uma permissão granular própria (não existe
 * 'storage' em PermissionKey) — quem chama já checou a permissão do seu
 * próprio domínio (ex.: 'conversations' pra WhatsApp) antes de chegar
 * aqui. O que ESTA camada garante, sempre, é isolamento por tenant.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { StorageService, SIGNED_URL_TTL_SECONDS, type StorageCategory, type StorageObjectRef } from '@/lib/storage'

// Margem de segurança: uma URL cacheada só é reaproveitada se ainda faltar
// mais que isso pra expirar — evita entregar uma URL que morre nos
// próximos segundos (ex.: browser começa o download e a assinatura expira
// no meio, ou o navegador guarda em cache HTTP algo prestes a expirar).
const SIGNED_URL_CACHE_SAFETY_MARGIN_SECONDS = 5 * 60

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024 // 20MB — mesmo teto já usado pelos uploads existentes (whatsapp-media, instagram-media)

const ALLOWED_MIME_BY_CATEGORY: Record<StorageCategory, string[]> = {
  whatsapp: ['image/jpeg', 'image/png', 'image/webp', 'audio/ogg', 'audio/webm', 'audio/opus', 'audio/mpeg', 'audio/mp4', 'audio/aac', 'video/mp4', 'video/3gpp', 'application/pdf'],
  instagram: ['image/jpeg', 'image/png', 'image/webp', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/aac'],
  attachments: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'],
  documents: ['application/pdf', 'image/jpeg', 'image/png'],
  avatars: ['image/jpeg', 'image/png', 'image/webp'],
  exports: ['text/csv', 'application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
}

export type StorageObjectRow = {
  id: string
  organization_id: string
  storage_provider: 'supabase' | 'r2' | 's3' | 'b2'
  bucket: string
  storage_key: string
  filename: string | null
  mime_type: string | null
  size_bytes: number | null
  status: 'active' | 'deleted'
  created_at: string
  cached_signed_url: string | null
  cached_signed_url_expires_at: string | null
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

/** Carrega o registro e confirma que pertence à org — helper interno,
 *  usado por getSignedUrl/deleteObject abaixo. Nunca gera URL nem
 *  deleta sem essa checagem passar. */
async function loadOwnedObject(orgId: string, objectId: string): Promise<StorageObjectRow | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('storage_objects')
    .select('*')
    .eq('id', objectId)
    .eq('organization_id', orgId)
    .eq('status', 'active')
    .maybeSingle()
  return (data as StorageObjectRow) ?? null
}

/**
 * Resolve a signed URL de leitura pra uma linha já carregada, reaproveitando
 * o cache em `storage_objects.cached_signed_url` quando ainda é válido
 * (ver SIGNED_URL_CACHE_SAFETY_MARGIN_SECONDS) — é isso que faz a URL
 * ficar estável por até 48h (SIGNED_URL_TTL_SECONDS) em vez de mudar a
 * cada render, permitindo o navegador cachear a imagem/arquivo também.
 *
 * O cache só se aplica ao caso "view" (inline, TTL/disposition padrão).
 * Um pedido de download (Content-Disposition: attachment) ou de TTL
 * customizado sempre gera uma URL nova, sem persistir — são casos raros
 * o bastante pra não valer a pena cachear, e misturar as duas variantes
 * na mesma coluna criaria um bug sutil (servir attachment quando o
 * caller queria inline, ou vice-versa).
 */
async function resolveSignedUrl(
  supabase: ReturnType<typeof createClient>,
  row: StorageObjectRow,
  opts?: { expiresInSeconds?: number; download?: boolean },
): Promise<string> {
  const isDefaultCase = !opts?.expiresInSeconds && !opts?.download

  if (isDefaultCase && row.cached_signed_url && row.cached_signed_url_expires_at) {
    const remainingMs = new Date(row.cached_signed_url_expires_at).getTime() - Date.now()
    if (remainingMs > SIGNED_URL_CACHE_SAFETY_MARGIN_SECONDS * 1000) {
      return row.cached_signed_url
    }
  }

  const ref: StorageObjectRef = { provider: row.storage_provider, bucket: row.bucket, storageKey: row.storage_key }
  const ttl = opts?.expiresInSeconds ?? SIGNED_URL_TTL_SECONDS
  const url = await StorageService.getSignedUrl(ref, {
    expiresInSeconds: ttl,
    downloadFilename: opts?.download ? (row.filename ?? undefined) : null,
  })

  if (isDefaultCase) {
    // Best-effort — se o UPDATE falhar por qualquer motivo, a URL ainda
    // é válida e retorna normalmente, só não fica cacheada dessa vez.
    await supabase
      .from('storage_objects')
      .update({
        cached_signed_url: url,
        cached_signed_url_expires_at: new Date(Date.now() + ttl * 1000).toISOString(),
      })
      .eq('id', row.id)
      .then(({ error }) => { if (error) console.error('[storage] falha ao cachear signed URL:', error.message) })
  }

  return url
}

/** URL temporária de leitura (Fase 7) — nunca uma URL pública
 *  permanente. Valida que o objeto pertence à org do usuário autenticado
 *  antes de gerar qualquer coisa. Reaproveita o cache quando possível
 *  (ver resolveSignedUrl). */
export async function getObjectSignedUrl(
  orgSlug: string,
  objectId: string,
  opts?: { expiresInSeconds?: number; download?: boolean },
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)

  const row = await loadOwnedObject(org.id, objectId)
  if (!row) return { ok: false, error: 'Arquivo não encontrado.' }

  try {
    const url = await resolveSignedUrl(createClient(), row, opts)
    return { ok: true, url }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Falha ao gerar link de acesso.' }
  }
}

/**
 * Versão em lote de `getObjectSignedUrl` — pensada pra ser chamada uma
 * vez no Server Component que monta uma lista (mensagens de uma
 * conversa, avatares de uma lista de contatos), resolvendo todas as
 * URLs de uma vez antes de renderizar o HTML. É isso que evita o
 * padrão "uma Server Action por imagem" (round-trip extra por item) —
 * ver a discussão de latência que motivou essa função.
 *
 * IDs que não pertencem à org, não existem, ou falham ao assinar
 * simplesmente não aparecem no Map de retorno — o caller decide o que
 * fazer com a ausência (ex.: não renderizar aquela imagem).
 */
export async function getObjectSignedUrls(
  orgSlug: string,
  objectIds: string[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  if (objectIds.length === 0) return result

  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data: rows } = await supabase
    .from('storage_objects')
    .select('*')
    .in('id', Array.from(new Set(objectIds)))
    .eq('organization_id', org.id)
    .eq('status', 'active')

  await Promise.all(
    ((rows as StorageObjectRow[]) ?? []).map(async row => {
      try {
        const url = await resolveSignedUrl(supabase, row)
        result.set(row.id, url)
      } catch (e: any) {
        console.error(`[storage] falha ao resolver signed URL de ${row.id}:`, e?.message)
      }
    }),
  )

  return result
}

/** Apaga do provider e marca o registro como deleted (mantém a linha
 *  pra auditoria — Fase 16 do plano não pede hard-delete do metadado,
 *  só do objeto físico). */
export async function deleteObject(orgSlug: string, objectId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)

  const row = await loadOwnedObject(org.id, objectId)
  if (!row) return { ok: false, error: 'Arquivo não encontrado.' }

  const ref: StorageObjectRef = { provider: row.storage_provider, bucket: row.bucket, storageKey: row.storage_key }
  try {
    await StorageService.delete(ref)
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Falha ao remover arquivo do provider.' }
  }

  const supabase = createClient()
  const { error } = await supabase
    .from('storage_objects')
    .update({ status: 'deleted' })
    .eq('id', objectId)
    .eq('organization_id', org.id)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
