'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'
import { uploadFile, deleteObject, getObjectSignedUrl, getObjectSignedUrls } from '@/actions/storage'
import { checkContatoPermission } from './contatos-shared'

/* -------- Foto do contato (avatar) --------
 * Primeiro fluxo migrado pra Storage Service (Cloudflare R2) — upload
 * novo vai pra lá, contato antigo com avatar_url (Supabase Storage,
 * público) continua funcionando sem mudança nenhuma. Ver
 * actions/storage.ts pra a camada compartilhada de upload/signed URL. */

const ALLOWED_AVATAR_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])
const MAX_AVATAR_SIZE = 5 * 1024 * 1024

export async function uploadContatoAvatar(
  orgSlug: string,
  contatoId: string,
  formData: FormData,
) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkContatoPermission(org.id, user.id)
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  const supabase = createClient()

  const file = formData.get('file') as File | null
  if (!file || typeof file !== 'object') return { ok: false as const, error: 'Arquivo ausente' }
  if (!ALLOWED_AVATAR_MIME.has(file.type)) {
    return { ok: false as const, error: 'Use uma imagem PNG, JPG ou WebP.' }
  }
  if (file.size > MAX_AVATAR_SIZE) {
    return { ok: false as const, error: 'Imagem muito grande (máx. 5MB).' }
  }

  const { data: contato } = await supabase
    .from('contatos')
    .select('id, avatar_url, avatar_storage_object_id')
    .eq('id', contatoId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!contato) return { ok: false as const, error: 'Contato não encontrado' }

  // uploadFile (actions/storage.ts) só aceita image/jpeg — normaliza o
  // 'image/jpg' não-padrão que ALLOWED_AVATAR_MIME aceita por precaução.
  const contentType = file.type === 'image/jpg' ? 'image/jpeg' : file.type
  const base64 = Buffer.from(await file.arrayBuffer()).toString('base64')

  const uploaded = await uploadFile(orgSlug, {
    category: 'avatars',
    scopeId: contatoId,
    filename: file.name,
    contentType,
    base64,
  })
  if (!uploaded.ok) return { ok: false as const, error: uploaded.error }

  const { error: updateError } = await supabase
    .from('contatos')
    .update({ avatar_storage_object_id: uploaded.objectId, avatar_url: null })
    .eq('id', contatoId)
    .eq('organization_id', org.id)
  if (updateError) {
    await deleteObject(orgSlug, uploaded.objectId)
    return { ok: false as const, error: updateError.message }
  }

  // Remove a foto anterior (best-effort) — legada (Supabase Storage) ou
  // já migrada (R2), pra não acumular lixo.
  if (contato.avatar_storage_object_id) {
    await deleteObject(orgSlug, contato.avatar_storage_object_id)
  } else if (contato.avatar_url) {
    const marker = '/contato-avatars/'
    const idx = contato.avatar_url.indexOf(marker)
    if (idx >= 0) {
      const oldPath = contato.avatar_url.slice(idx + marker.length)
      if (oldPath) await supabase.storage.from('contato-avatars').remove([oldPath])
    }
  }

  const signed = await getObjectSignedUrl(orgSlug, uploaded.objectId)
  if (!signed.ok) return { ok: false as const, error: signed.error }

  revalidatePath(`/app/${orgSlug}/contatos`)
  revalidatePath(`/app/${orgSlug}/contatos/${contatoId}`)
  return { ok: true as const, url: signed.url }
}

export async function removeContatoAvatar(orgSlug: string, contatoId: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkContatoPermission(org.id, user.id)
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  const supabase = createClient()

  const { data: contato } = await supabase
    .from('contatos')
    .select('avatar_url, avatar_storage_object_id')
    .eq('id', contatoId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!contato) return { ok: false as const, error: 'Contato não encontrado' }

  const { error } = await supabase
    .from('contatos')
    .update({ avatar_url: null, avatar_storage_object_id: null })
    .eq('id', contatoId)
    .eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }

  if (contato.avatar_storage_object_id) {
    await deleteObject(orgSlug, contato.avatar_storage_object_id)
  } else if (contato.avatar_url) {
    const marker = '/contato-avatars/'
    const idx = contato.avatar_url.indexOf(marker)
    if (idx >= 0) {
      const oldPath = contato.avatar_url.slice(idx + marker.length)
      if (oldPath) await supabase.storage.from('contato-avatars').remove([oldPath])
    }
  }

  revalidatePath(`/app/${orgSlug}/contatos`)
  revalidatePath(`/app/${orgSlug}/contatos/${contatoId}`)
  return { ok: true as const }
}

/**
 * Resolve avatar_storage_object_id → signed URL do R2 pra uma lista de
 * contatos, de uma vez (uma chamada em lote, não uma por contato — ver
 * actions/storage.ts::getObjectSignedUrls). Contato legado (avatar_url
 * do Supabase Storage, sem avatar_storage_object_id) não precisa de
 * nada — o campo já é a URL final.
 *
 * Devolve a MESMA lista recebida, só com `avatar_url` substituído pela
 * signed URL quando aplicável — quem chama continua lendo `avatar_url`
 * normalmente, sem saber se veio do R2 ou do Supabase.
 */
export async function resolveContatoAvatars<T extends { avatar_url: string | null; avatar_storage_object_id?: string | null }>(
  orgSlug: string,
  rows: T[],
): Promise<T[]> {
  const objectIds = rows.map(r => r.avatar_storage_object_id).filter((id): id is string => !!id)
  if (objectIds.length === 0) return rows

  const urls = await getObjectSignedUrls(orgSlug, objectIds)
  return rows.map(r =>
    r.avatar_storage_object_id && urls.has(r.avatar_storage_object_id)
      ? { ...r, avatar_url: urls.get(r.avatar_storage_object_id)! }
      : r,
  )
}

/* -------- Status de cliente (marcar / desmarcar) -------- */

