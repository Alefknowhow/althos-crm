/**
 * A `profile_pic` que a Meta devolve pro perfil do Instagram é uma URL
 * assinada do CDN deles com expiração curta (poucos dias) — se a gente
 * guardar esse link direto no banco, a foto para de carregar assim que ela
 * expira. Aqui a gente baixa a imagem uma vez e guarda no nosso próprio
 * Storage, com URL permanente.
 */

import type { createAdminClient } from '@/lib/supabase/server'

type Admin = ReturnType<typeof createAdminClient>

const BUCKET = 'contato-avatars'

/** Best-effort: baixa `sourceUrl` e sobe pro Storage sob `instagram/{key}.jpg`.
 *  Retorna a URL permanente, ou `sourceUrl` (fallback) se o download/upload falhar. */
export async function cacheInstagramAvatar(admin: Admin, sourceUrl: string, key: string): Promise<string> {
  try {
    const res = await fetch(sourceUrl)
    if (!res.ok) return sourceUrl
    const buf = Buffer.from(await res.arrayBuffer())
    const path = `instagram/${key}.jpg`
    const { error } = await admin.storage.from(BUCKET).upload(path, buf, {
      contentType: res.headers.get('content-type') || 'image/jpeg',
      upsert: true,
    })
    if (error) return sourceUrl
    const { data } = admin.storage.from(BUCKET).getPublicUrl(path)
    return data.publicUrl
  } catch {
    return sourceUrl
  }
}
