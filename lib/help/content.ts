/**
 * Althos CRM — Manual do usuário (base de conhecimento).
 *
 * Fonte única de verdade usada por DOIS consumidores:
 *  1. A Central de Ajuda dinâmica (app/app/[orgSlug]/ajuda) — renderiza os
 *     blocos visualmente, com busca e navegação por categoria.
 *  2. O chat de suporte com IA (actions/support-chat) — usa `serializeHelpForAI`
 *     para transformar todo o conteúdo em texto plano e injetar como contexto
 *     (com prompt caching) para responder dúvidas do usuário.
 *
 * Módulo puro (sem 'use client' / 'use server') para ser importado nos dois lados.
 *
 * Ao adicionar/editar funcionalidades do produto, atualize este arquivo —
 * a ajuda e o suporte por IA ficam corretos automaticamente. O conteúdo em si
 * (HELP_CATEGORIES) mora em content-data-1..4.ts, split por tamanho.
 *
 * Categorias com `niches` definido só aparecem pra organizações daquele
 * nicho (ver `getHelpCategoriesForNiche`) — tanto na Central de Ajuda
 * quanto no manual injetado no chat de suporte. Categorias sem `niches`
 * são Core: aparecem pra qualquer organização.
 */

import type { NicheKey } from '@/lib/niche'
import { HELP_CATEGORIES_PART_1 } from './content-data-1'
import { HELP_CATEGORIES_PART_2 } from './content-data-2'
import { HELP_CATEGORIES_PART_3 } from './content-data-3'
import { HELP_CATEGORIES_PART_4 } from './content-data-4'

// ── Tipos ───────────────────────────────────────────────────────────────────

export type HelpBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'steps'; items: string[] }
  | { type: 'list'; items: string[] }
  | { type: 'tip'; text: string }
  | { type: 'warning'; text: string }
  | { type: 'faq'; items: { q: string; a: string }[] }

export type HelpArticle = {
  slug: string
  title: string
  summary: string
  /** Termos extras para a busca (sinônimos, nomes de menu, etc). */
  keywords: string[]
  blocks: HelpBlock[]
}

export type HelpCategory = {
  slug: string
  title: string
  /** Nome do ícone em lucide-react. */
  icon: string
  description: string
  /** Nichos que veem esta categoria (ver NicheKey em lib/niche.ts). Omitido = Core, aparece pra todo mundo. */
  niches?: NicheKey[]
  articles: HelpArticle[]
}

// ── Conteúdo ────────────────────────────────────────────────────────────────

export const HELP_CATEGORIES: HelpCategory[] = [
  ...HELP_CATEGORIES_PART_1,
  ...HELP_CATEGORIES_PART_2,
  ...HELP_CATEGORIES_PART_3,
  ...HELP_CATEGORIES_PART_4,
]

// ── Utilidades ──────────────────────────────────────────────────────────────

/** Categorias visíveis pra um nicho: Core (sem `niches`) + a(s) da vertical atual. */
export function getHelpCategoriesForNiche(nicheKey: NicheKey | null): HelpCategory[] {
  return HELP_CATEGORIES.filter((c) => !c.niches || (nicheKey !== null && c.niches.includes(nicheKey)))
}

/** Lista achatada de todos os artigos com referência à categoria. */
export function allArticles(): Array<HelpArticle & { category: HelpCategory }> {
  return HELP_CATEGORIES.flatMap((category) =>
    category.articles.map((article) => ({ ...article, category })),
  )
}

/** Busca um artigo por slug de categoria + slug de artigo. */
export function findArticle(
  categorySlug: string,
  articleSlug: string,
): { category: HelpCategory; article: HelpArticle } | null {
  const category = HELP_CATEGORIES.find((c) => c.slug === categorySlug)
  if (!category) return null
  const article = category.articles.find((a) => a.slug === articleSlug)
  if (!article) return null
  return { category, article }
}

/** Converte um bloco em texto plano (para busca e para a IA). */
function blockToText(block: HelpBlock): string {
  switch (block.type) {
    case 'paragraph':
    case 'tip':
    case 'warning':
    case 'heading':
      return block.text
    case 'steps':
    case 'list':
      return block.items.map((i, idx) => `${idx + 1}. ${i}`).join('\n')
    case 'faq':
      return block.items.map((i) => `P: ${i.q}\nR: ${i.a}`).join('\n')
    default:
      return ''
  }
}

/** Texto plano de um artigo (título + resumo + corpo). */
export function articleToText(article: HelpArticle): string {
  const body = article.blocks.map(blockToText).join('\n')
  return `${article.title}\n${article.summary}\n${body}`
}

/**
 * Serializa TODO o manual em texto plano, pronto para ser injetado como
 * contexto do chat de suporte com IA (com prompt caching). Inclui marcadores
 * de categoria/artigo para a IA conseguir citar a seção certa.
 */
export function serializeHelpForAI(nicheKey: NicheKey | null = null): string {
  const parts: string[] = [
    'MANUAL DO USUÁRIO — ALTHOS CRM',
    'Use exclusivamente as informações abaixo para responder dúvidas sobre o produto.',
    '',
  ]
  for (const category of getHelpCategoriesForNiche(nicheKey)) {
    parts.push(`## CATEGORIA: ${category.title}`)
    parts.push(category.description)
    for (const article of category.articles) {
      parts.push('')
      parts.push(`### ${article.title}`)
      parts.push(article.summary)
      for (const block of article.blocks) {
        if (block.type === 'heading') {
          parts.push(`**${block.text}**`)
        } else if (block.type === 'tip') {
          parts.push(`Dica: ${block.text}`)
        } else if (block.type === 'warning') {
          parts.push(`Atenção: ${block.text}`)
        } else {
          parts.push(blockToText(block))
        }
      }
    }
    parts.push('')
  }
  return parts.join('\n')
}
