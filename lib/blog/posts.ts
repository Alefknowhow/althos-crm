/**
 * Engine simples de blog sem dependências externas.
 * O conteúdo é modelado em blocos (heading/parágrafo/lista/citação) e
 * renderizado por components/site/PostBody.tsx. Cada post é otimizado para SEO
 * (title, description, headings, palavras-chave) e tráfego orgânico.
 *
 * Para adicionar um post: acrescente um objeto a um dos posts-data-N.ts
 * (split por tamanho -- ver esses arquivos). O slug vira a URL /blog/[slug].
 * Mantenha 1 H1 (o title) e use h2/h3 nos blocos.
 */

import { POSTS_PART_1 } from './posts-data-1'
import { POSTS_PART_2 } from './posts-data-2'
import { POSTS_PART_3 } from './posts-data-3'
import { POSTS_PART_4 } from './posts-data-4'

export type PostBlock =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'quote'; text: string }
  | { type: 'cta'; text: string }

export interface BlogPost {
  slug: string
  title: string
  description: string
  category: BlogCategory
  author: string
  date: string            // ISO yyyy-mm-dd
  readingMinutes: number
  excerpt: string
  blocks: PostBlock[]
}

export type BlogCategory =
  | 'Meta Ads'
  | 'Google Ads'
  | 'Funil de Vendas'
  | 'Gestão de Equipe'
  | 'Treinamento de Vendas'
  | 'WhatsApp API'

export const BLOG_CATEGORIES: BlogCategory[] = [
  'Meta Ads',
  'Google Ads',
  'Funil de Vendas',
  'Gestão de Equipe',
  'Treinamento de Vendas',
  'WhatsApp API',
]

export const POSTS: BlogPost[] = [
  ...POSTS_PART_1,
  ...POSTS_PART_2,
  ...POSTS_PART_3,
  ...POSTS_PART_4,
]

/** Lista de posts ordenada do mais novo para o mais antigo. */
export const POSTS_SORTED = [...POSTS].sort((a, b) => (a.date < b.date ? 1 : -1))

export function getPost(slug: string): BlogPost | undefined {
  return POSTS.find(p => p.slug === slug)
}

export function getRelatedPosts(post: BlogPost, limit = 2): BlogPost[] {
  return POSTS_SORTED.filter(p => p.slug !== post.slug && p.category === post.category)
    .concat(POSTS_SORTED.filter(p => p.slug !== post.slug && p.category !== post.category))
    .slice(0, limit)
}

export function formatPostDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
}
