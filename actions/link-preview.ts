'use server'

import { requireAuth } from '@/lib/supabase/types'
import { createAdminClient } from '@/lib/supabase/server'
import { fetchOgMetadata, isFetchableUrl } from '@/lib/link-preview/fetch-metadata'

// Cache de 7 dias — metadado de site (título/descrição/imagem) muda
// raramente o bastante pra isso não incomodar, e evita rebuscar a mesma
// URL a cada vez que a mensagem é renderizada.
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export type LinkPreviewResult = {
  url: string
  title: string | null
  description: string | null
  siteName: string | null
  imageProxyUrl: string | null
}

/** Busca (com cache de 7 dias em `link_previews`) os metadados Open
 *  Graph de uma URL. Requer usuário autenticado (não é endpoint
 *  público) mas não filtra por organização — o conteúdo é público por
 *  natureza (vem do site de destino), então o cache é compartilhado
 *  entre todas as orgs, e a checagem de auth só evita abuso do proxy
 *  por quem não está logado no CRM. */
export async function getLinkPreview(url: string): Promise<LinkPreviewResult | null> {
  await requireAuth()
  if (!isFetchableUrl(url)) return null

  const admin = createAdminClient()
  const { data: cached } = await admin.from('link_previews').select('*').eq('url', url).maybeSingle()

  if (cached && Date.now() - new Date(cached.fetched_at).getTime() < CACHE_TTL_MS) {
    if (cached.fetch_failed) return null
    return {
      url,
      title: cached.title,
      description: cached.description,
      siteName: cached.site_name,
      imageProxyUrl: cached.image_url ? `/api/link-preview-image/${cached.id}` : null,
    }
  }

  const meta = await fetchOgMetadata(url)
  if (!meta) {
    await admin.from('link_previews').upsert(
      { url, fetch_failed: true, fetched_at: new Date().toISOString() },
      { onConflict: 'url' },
    )
    return null
  }

  const { data: saved } = await admin
    .from('link_previews')
    .upsert(
      {
        url,
        title: meta.title,
        description: meta.description,
        site_name: meta.siteName,
        image_url: meta.imageUrl,
        fetch_failed: false,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: 'url' },
    )
    .select('id')
    .single()

  return {
    url,
    title: meta.title,
    description: meta.description,
    siteName: meta.siteName,
    imageProxyUrl: saved && meta.imageUrl ? `/api/link-preview-image/${saved.id}` : null,
  }
}
