'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/supabase/types'
import { uploadFile, getObjectSignedUrl, deleteObject } from '@/actions/storage'

// ── Types ─────────────────────────────────────────────────────────────────────

export type UserProfile = {
  id:         string
  email:      string
  name:       string
  phone:      string
  avatar_url: string | null
  memberships: Array<{
    role: string
    organizations: { id: string; name: string; slug: string } | null
  }>
}

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * `orgSlug` é opcional só por compatibilidade com chamadas antigas sem
 * contexto de org — mas sem ele, um avatar novo (armazenado no R2, ver
 * uploadUserAvatar abaixo) não é resolvido pra URL (a Storage Service
 * exige org pra checar isolamento de tenant). Todo caller dentro de
 * `/app/[orgSlug]/*` deve sempre passar o orgSlug da rota atual.
 */
export async function getUserProfile(orgSlug?: string): Promise<UserProfile | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: memberships } = await supabase
    .from('memberships')
    .select('role, organizations(id, name, slug)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  let avatarUrl = (user.user_metadata?.avatar_url as string) ?? null
  const avatarObjectId = user.user_metadata?.avatar_storage_object_id as string | undefined
  if (avatarObjectId && orgSlug) {
    const signed = await getObjectSignedUrl(orgSlug, avatarObjectId)
    if (signed.ok) avatarUrl = signed.url
  }

  return {
    id:         user.id,
    email:      user.email ?? '',
    name:       (user.user_metadata?.name  as string) ?? '',
    phone:      (user.user_metadata?.phone as string) ?? '',
    avatar_url: avatarUrl,
    memberships: (memberships ?? []) as unknown as UserProfile['memberships'],
  }
}

// ── Foto de perfil ────────────────────────────────────────────────────────────
// Mesmo padrão já usado pro avatar de contato (actions/contatos.ts::uploadContatoAvatar)
// — categoria 'avatars' na Storage Service (R2), scopeId = user.id em vez de
// contatoId. Não existe tabela `profiles`; a referência (avatar_storage_object_id)
// fica em user_metadata do Supabase Auth, igual name/phone.

const ALLOWED_AVATAR_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])
const MAX_AVATAR_SIZE = 5 * 1024 * 1024

export async function uploadUserAvatar(orgSlug: string, formData: FormData) {
  const user = await requireAuth()
  const supabase = createClient()

  const file = formData.get('file') as File | null
  if (!file || typeof file !== 'object') return { ok: false as const, error: 'Arquivo ausente' }
  if (!ALLOWED_AVATAR_MIME.has(file.type)) return { ok: false as const, error: 'Use uma imagem PNG, JPG ou WebP.' }
  if (file.size > MAX_AVATAR_SIZE) return { ok: false as const, error: 'Imagem muito grande (máx. 5MB).' }

  const contentType = file.type === 'image/jpg' ? 'image/jpeg' : file.type
  const base64 = Buffer.from(await file.arrayBuffer()).toString('base64')
  const uploaded = await uploadFile(orgSlug, { category: 'avatars', scopeId: user.id, filename: file.name, contentType, base64 })
  if (!uploaded.ok) return { ok: false as const, error: uploaded.error }

  const prevObjectId = (user as any).user_metadata?.avatar_storage_object_id as string | undefined
  const { error: updateError } = await supabase.auth.updateUser({
    data: { avatar_storage_object_id: uploaded.objectId, avatar_url: null },
  })
  if (updateError) {
    await deleteObject(orgSlug, uploaded.objectId)
    return { ok: false as const, error: updateError.message }
  }
  // Apaga a foto anterior (best-effort) — nunca acumula lixo no bucket.
  if (prevObjectId) await deleteObject(orgSlug, prevObjectId)

  const signed = await getObjectSignedUrl(orgSlug, uploaded.objectId)
  if (!signed.ok) return { ok: false as const, error: signed.error }
  return { ok: true as const, url: signed.url }
}

export async function removeUserAvatar(orgSlug: string) {
  const user = await requireAuth()
  const supabase = createClient()

  const objectId = (user as any).user_metadata?.avatar_storage_object_id as string | undefined
  const { error } = await supabase.auth.updateUser({ data: { avatar_storage_object_id: null, avatar_url: null } })
  if (error) return { ok: false as const, error: error.message }
  if (objectId) await deleteObject(orgSlug, objectId)
  return { ok: true as const }
}

// ── Update name / phone ───────────────────────────────────────────────────────

export async function updateProfileInfo(name: string, phone: string) {
  await requireAuth()
  const supabase = createClient()
  const { error } = await supabase.auth.updateUser({ data: { name, phone } })
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}

// ── Request email change ──────────────────────────────────────────────────────
// Supabase sends a confirmation link to the NEW address; only swaps after click.

export async function requestEmailChange(newEmail: string) {
  await requireAuth()
  const supabase = createClient()
  const { error } = await supabase.auth.updateUser(
    { email: newEmail.trim().toLowerCase() },
  )
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}

// ── Change password ───────────────────────────────────────────────────────────

export async function changePassword(currentPassword: string, newPassword: string) {
  const user = await requireAuth()
  if (newPassword.length < 8)
    return { ok: false as const, error: 'A nova senha precisa ter pelo menos 8 caracteres.' }
  if (!currentPassword)
    return { ok: false as const, error: 'Informe sua senha atual.' }
  if (currentPassword === newPassword)
    return { ok: false as const, error: 'A nova senha deve ser diferente da atual.' }

  const supabase = createClient()

  // SECURITY: re-authenticate with the current password before allowing a
  // password change. Supabase's updateUser({ password }) alone does NOT verify
  // the old password, so without this an attacker with a hijacked session could
  // lock the real owner out. signInWithPassword fails on a wrong password.
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email ?? '',
    password: currentPassword,
  })
  if (reauthError) {
    return { ok: false as const, error: 'Senha atual incorreta.' }
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}
