import type { Metadata } from 'next'
import type { NicheContent } from './niches'

/**
 * Metadata completa (title/description/OG/Twitter/canonical) para uma landing
 * data-driven (nicho ou funcionalidade). Centraliza o padrão para não repetir
 * o mesmo bloco de OG/Twitter em cada page.tsx — canonical relativo resolve
 * absoluto via metadataBase (definido em app/layout.tsx).
 */
export function buildLandingMetadata(c: NicheContent): Metadata {
  const path = `/${c.slug}`
  return {
    title: c.metaTitle,
    description: c.metaDescription,
    alternates: { canonical: path },
    openGraph: {
      title: c.metaTitle,
      description: c.metaDescription,
      url: path,
      siteName: 'Althos CRM',
      type: 'website',
      locale: 'pt_BR',
    },
    twitter: {
      card: 'summary_large_image',
      title: c.metaTitle,
      description: c.metaDescription,
    },
  }
}
