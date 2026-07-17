import type { MetadataRoute } from 'next'
import { BRAND } from '@/lib/constants/brand'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/app/', // CRM autenticado — nada aqui é público
        '/api/',
        '/super-admin/',
        '/onboarding',
        '/mfa',
        '/auth/',
        '/convite/', '/invite/', // convites são específicos de uma pessoa
        '/p/', '/v/', '/f/', '/book/', // páginas públicas token-based, sem valor de descoberta
      ],
    },
    sitemap: `${BRAND.domain}/sitemap.xml`,
  }
}
