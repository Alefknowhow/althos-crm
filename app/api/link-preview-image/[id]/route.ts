import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/supabase/types'
import { fetchPreviewImage } from '@/lib/link-preview/fetch-metadata'

/**
 * Proxy da imagem de prévia de link — nunca expõe a URL de terceiro
 * direto pro <img src> do navegador (isso furaria o CSP, que só libera
 * domínios conhecidos em img-src). O client só vê /api/link-preview-image/{id},
 * sempre same-origin.
 *
 * `id` só resolve pra uma URL que JÁ foi vetada por fetchOgMetadata
 * (actions/link-preview.ts) — nunca aceita URL arbitrária vinda do
 * client, o que fecharia a proteção de SSRF do lado de baixo.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAuth()
  } catch {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const admin = createAdminClient()
  const { data: row } = await admin.from('link_previews').select('image_url').eq('id', params.id).maybeSingle()
  if (!row?.image_url) return new NextResponse('Not found', { status: 404 })

  const image = await fetchPreviewImage(row.image_url)
  if (!image) return new NextResponse('Not found', { status: 404 })

  return new NextResponse(new Uint8Array(image.bytes), {
    headers: {
      'Content-Type': image.contentType,
      'Cache-Control': 'private, max-age=86400',
    },
  })
}
