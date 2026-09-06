import type { MetadataRoute } from 'next'
import { BRAND } from '@/lib/constants/brand'

/**
 * robots.txt não é mecanismo de segurança — é só um sinal de rastreamento
 * pra crawlers bem-comportados. As rotas privadas listadas aqui já são
 * protegidas de verdade no servidor (auth/RLS/permissão); isso aqui só evita
 * que apareçam em buscadores. Padrão: prefixo com barra (`/x/`) bloqueia a
 * rota e todas as subrotas; `/x$`/`/x?` cobre a própria rota exata (sem
 * subrotas) sem bloquear páginas públicas com nome parecido (ex.: `/planos`
 * não é afetado por um `Disallow: /p/`).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      disallow: [
        // CRM autenticado (app/app/[orgSlug]/...) — sem página nesse prefixo
        // exato, mas cobre tudo por baixo.
        '/app/',
        '/api/',
        '/super-admin/',
        // Páginas únicas, sem subrota — âncora exata evita bloquear por
        // engano algo como "/onboarding-alguma-coisa" no futuro.
        '/onboarding$', '/onboarding?',
        '/mfa$', '/mfa?',
        '/auth/',
        // Convites — específicos de uma pessoa, sem valor de descoberta.
        '/convite/', '/convite$', '/convite?',
        '/invite/', '/invite$', '/invite?',
        // Páginas públicas token-based — a própria página já marca
        // noindex/nofollow via <meta name="robots">, isso aqui é reforço.
        '/p/', '/p$', '/p?',
        '/v/', '/v$', '/v?',
        '/f/', '/f$', '/f?',
        '/book/', '/book$', '/book?',
      ],
    },
    sitemap: `${BRAND.domain}/sitemap.xml`,
  }
}
