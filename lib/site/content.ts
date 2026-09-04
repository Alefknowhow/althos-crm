/**
 * Conteúdo do site institucional (marketing) -- barrel.
 * Fonte única reutilizada por /funcionalidades, /para-quem-e, /como-funciona,
 * /faq e a home. Mantém o copy fora dos componentes para facilitar edição e SEO.
 *
 * Split across:
 *   - content-nav.ts: SITE_NAV
 *   - content-features.ts: FEATURES (página /funcionalidades)
 *   - content-niches.ts: NICHES (página /para-quem-e)
 *   - content-faq.ts: HOW_IT_WORKS, DIFFERENTIATORS, FAQ, HOME_GEO_*, HOME_FAQ
 */

export * from './content-nav'
export * from './content-features'
export * from './content-niches'
export * from './content-faq'
