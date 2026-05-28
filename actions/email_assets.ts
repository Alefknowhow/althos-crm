'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization, requireAuth } from '@/lib/supabase/types'

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'])
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

/**
 * Uploads an image to the email-assets Storage bucket and returns its public URL.
 * Path layout: <org_id>/<timestamp>-<safe-filename>. Org-scoping is enforced
 * both client-side (we read the user's org) and via RLS on storage.objects.
 */
export async function uploadEmailImage(
  orgSlug: string,
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const file = formData.get('file') as File | null
  if (!file || typeof file !== 'object') return { ok: false, error: 'Arquivo ausente' }

  if (!ALLOWED_MIME.has(file.type)) {
    return { ok: false, error: `Tipo não permitido: ${file.type}. Use PNG, JPG, GIF ou WebP.` }
  }
  if (file.size > MAX_SIZE) {
    return { ok: false, error: `Arquivo muito grande (>${MAX_SIZE / 1024 / 1024} MB)` }
  }

  // Sanitize filename: keep extension, strip directory and weird chars.
  const rawName = file.name || 'image'
  const dotIdx = rawName.lastIndexOf('.')
  const ext = dotIdx > 0 ? rawName.slice(dotIdx + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : 'png'
  const base = (dotIdx > 0 ? rawName.slice(0, dotIdx) : rawName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'image'

  const path = `${org.id}/${Date.now()}-${base}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const { error } = await supabase.storage
    .from('email-assets')
    .upload(path, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    })

  if (error) {
    console.error('uploadEmailImage error:', error)
    return { ok: false, error: error.message }
  }

  const { data } = supabase.storage.from('email-assets').getPublicUrl(path)
  return { ok: true, url: data.publicUrl }
}
