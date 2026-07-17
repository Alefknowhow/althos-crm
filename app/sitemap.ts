import type { MetadataRoute } from 'next'
import { BRAND } from '@/lib/constants/brand'
import { NICHE_SLUGS } from '@/lib/landing/niches'
import { FEATURE_SLUGS } from '@/lib/landing/features'
import { POSTS } from '@/lib/blog/posts'

/**
 * Sitemap dinâmico — só rotas públicas e indexáveis. Nada de /app/*,
 * /configuracoes, /super-admin, auth ou páginas token-based (/p/, /v/, /f/,
 * /book/, /convite/, /invite/) — essas não fazem sentido pra um crawler,
 * cada uma é específica de um tenant/pessoa e não existe "descoberta" possível.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = BRAND.domain

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/funcionalidades`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/como-funciona`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/para-quem-e`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/por-que-nos`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/planos`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/faq`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/blog`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/termos`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/privacidade`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/cookies`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/exclusao-de-dados`, changeFrequency: 'yearly', priority: 0.2 },
  ]

  const nicheRoutes: MetadataRoute.Sitemap = NICHE_SLUGS.map(slug => ({
    url: `${base}/${slug}`,
    changeFrequency: 'monthly',
    priority: 0.85,
  }))

  const featureRoutes: MetadataRoute.Sitemap = FEATURE_SLUGS.map(slug => ({
    url: `${base}/${slug}`,
    changeFrequency: 'monthly',
    priority: 0.85,
  }))

  const blogRoutes: MetadataRoute.Sitemap = POSTS.map(post => ({
    url: `${base}/blog/${post.slug}`,
    lastModified: post.date,
    changeFrequency: 'monthly',
    priority: 0.5,
  }))

  return [...staticRoutes, ...nicheRoutes, ...featureRoutes, ...blogRoutes]
}
