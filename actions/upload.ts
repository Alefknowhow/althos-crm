'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

/**
 * Upload an image to the `form-assets` Supabase Storage bucket.
 * Returns the permanent public URL.
 *
 * The path is scoped to the org: `<org_id>/<timestamp>-<random>.<ext>`
 * so RLS policies can enforce per-org write access.
 */
export async function uploadFormAsset(
  orgSlug: string,
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { ok: false, error: 'Arquivo vazio' }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { ok: false, error: 'Formato não suportado. Use JPG, PNG, WebP, GIF ou SVG.' }
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: 'Arquivo muito grande. O limite é 5 MB.' }
  }

  // Derive a safe extension from the MIME type to avoid filename spoofing
  const extMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png':  'png',
    'image/webp': 'webp',
    'image/gif':  'gif',
    'image/svg+xml': 'svg',
  }
  const ext = extMap[file.type] ?? 'bin'
  const path = `${org.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const bytes = await file.arrayBuffer()

  const { error: uploadError } = await supabase.storage
    .from('form-assets')
    .upload(path, bytes, { contentType: file.type, upsert: false })

  if (uploadError) return { ok: false, error: uploadError.message }

  const { data: { publicUrl } } = supabase.storage.from('form-assets').getPublicUrl(path)
  return { ok: true, url: publicUrl }
}
