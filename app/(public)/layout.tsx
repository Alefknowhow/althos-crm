import { BRAND } from '@/lib/constants/brand'

/**
 * Layout for all public (unauthenticated) pages.
 * Forces light-mode CSS variables regardless of the user's OS theme,
 * so login/signup/invite screens always look like designed.
 */

/** JSON-LD Organization + WebSite — entidade da marca, presente em todo o site público. */
function orgJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: BRAND.name,
        url: BRAND.domain,
        logo: `${BRAND.domain}/icon.svg`,
        description: BRAND.description,
      },
      {
        '@type': 'WebSite',
        name: BRAND.name,
        url: BRAND.domain,
      },
    ],
  }
}

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="light">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd()) }}
      />
      {children}
    </div>
  )
}
