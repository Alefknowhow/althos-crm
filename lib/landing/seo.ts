import type { Metadata } from 'next'
import type { NicheContent } from './niches'

/**
 * Metadata completa (title/description/OG/Twitter/canonical) para uma landing
 * data-driven (nicho ou funcionalidade). Centraliza o padrão para não repetir
 * o mesmo bloco de OG/Twitter em cada page.tsx — canonical relativo resolve
 * absoluto via metadataBase (definido em app/layout.tsx).
 */
export function buildLandingMetadata(c: NicheContent): Metadata {
  return buildPageMetadata({ title: c.metaTitle, description: c.metaDescription, path: `/${c.slug}` })
}

/**
 * Metadata completa (OG/Twitter/canonical) para páginas institucionais que
 * não são data-driven (funcionalidades, como-funciona, para-quem-é, por-que-
 * nós, blog). Mesmo padrão de buildLandingMetadata, só que recebendo o
 * title/description/path diretamente em vez de um NicheContent.
 */
export function buildPageMetadata({
  title, description, path,
}: {
  title: string
  description: string
  path: string
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      siteName: 'Althos CRM',
      type: 'website',
      locale: 'pt_BR',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}
