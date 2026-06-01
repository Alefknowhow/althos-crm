'use client'

import { useMemo, useState } from 'react'
import {
  type HelpBlock,
  type HelpCategory,
  type HelpArticle,
  articleToText,
} from '@/lib/help/content'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Search,
  Rocket,
  Kanban,
  MessageSquare,
  Calendar,
  Megaphone,
  Zap,
  Sparkles,
  Settings,
  Lightbulb,
  AlertTriangle,
  ChevronRight,
  BookOpen,
  LifeBuoy,
} from 'lucide-react'

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Rocket,
  Kanban,
  MessageSquare,
  Calendar,
  Megaphone,
  Zap,
  Sparkles,
  Settings,
  BookOpen,
}

function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? BookOpen
  return <Icon className={className} />
}

// ── Block renderer ──────────────────────────────────────────────────────────

function Block({ block }: { block: HelpBlock }) {
  switch (block.type) {
    case 'paragraph':
      return <p className="text-[15px] leading-relaxed text-foreground/90">{block.text}</p>
    case 'heading':
      return (
        <h3 className="text-base font-semibold tracking-apple-tight mt-6 mb-1">
          {block.text}
        </h3>
      )
    case 'list':
      return (
        <ul className="space-y-1.5 pl-1">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-2 text-[15px] leading-relaxed text-foreground/90">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )
    case 'steps':
      return (
        <ol className="space-y-2">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-foreground/90">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                {i + 1}
              </span>
              <span className="pt-0.5">{item}</span>
            </li>
          ))}
        </ol>
      )
    case 'tip':
      return (
        <div className="flex gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
          <Lightbulb className="h-5 w-5 shrink-0 text-brand-600" />
          <p className="text-sm leading-relaxed text-brand-900">{block.text}</p>
        </div>
      )
    case 'warning':
      return (
        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-sm leading-relaxed text-amber-900">{block.text}</p>
        </div>
      )
    case 'faq':
      return (
        <div className="space-y-3">
          {block.items.map((item, i) => (
            <div key={i}>
              <p className="font-medium text-foreground">{item.q}</p>
              <p className="text-[15px] leading-relaxed text-muted-foreground">{item.a}</p>
            </div>
          ))}
        </div>
      )
    default:
      return null
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function AjudaClient({ categories }: { categories: HelpCategory[] }) {
  const [query, setQuery] = useState('')
  const [activeCat, setActiveCat] = useState(categories[0]?.slug ?? '')
  const [activeArticle, setActiveArticle] = useState(
    categories[0]?.articles[0]?.slug ?? '',
  )

  const search = query.trim().toLowerCase()

  // Search across all articles.
  const results = useMemo(() => {
    if (!search) return null
    const out: Array<{ category: HelpCategory; article: HelpArticle }> = []
    for (const category of categories) {
      for (const article of category.articles) {
        const haystack = (
          articleToText(article) +
          ' ' +
          article.keywords.join(' ') +
          ' ' +
          category.title
        ).toLowerCase()
        if (haystack.includes(search)) out.push({ category, article })
      }
    }
    return out
  }, [search, categories])

  const currentCategory = categories.find((c) => c.slug === activeCat) ?? categories[0]
  const currentArticle =
    currentCategory?.articles.find((a) => a.slug === activeArticle) ??
    currentCategory?.articles[0]

  function openArticle(catSlug: string, articleSlug: string) {
    setActiveCat(catSlug)
    setActiveArticle(articleSlug)
    setQuery('')
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-brand-600">
          <LifeBuoy className="h-5 w-5" />
          <span className="text-sm font-medium uppercase tracking-wide">Central de Ajuda</span>
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-apple-tight sm:text-4xl">
          Como podemos ajudar?
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Guias e respostas para usar todas as ferramentas do Althos CRM. Não
          achou o que procura? Use o chat de suporte no canto inferior direito.
        </p>

        {/* Search */}
        <div className="relative mt-5 max-w-xl">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar nos guias…"
            className="h-12 pl-10 text-base"
          />
        </div>
      </div>

      {results ? (
        /* Search results */
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {results.length} resultado{results.length === 1 ? '' : 's'} para “{query}”
          </p>
          {results.map(({ category, article }) => (
            <button
              key={`${category.slug}/${article.slug}`}
              onClick={() => openArticle(category.slug, article.slug)}
              className="flex w-full items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/40"
            >
              <CategoryIcon name={category.icon} className="mt-0.5 h-5 w-5 text-brand-600" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{article.title}</span>
                  <Badge variant="secondary" className="text-[10px]">{category.title}</Badge>
                </div>
                <p className="truncate text-sm text-muted-foreground">{article.summary}</p>
              </div>
            </button>
          ))}
          {results.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
              Nenhum guia encontrado. Tente outros termos ou fale com o suporte.
            </div>
          )}
        </div>
      ) : (
        /* Browse: sidebar nav + article */
        <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
          {/* Category / article nav */}
          <nav className="space-y-5 lg:sticky lg:top-6 lg:self-start">
            {categories.map((category) => (
              <div key={category.slug}>
                <div className="mb-1.5 flex items-center gap-2 px-2">
                  <CategoryIcon name={category.icon} className="h-4 w-4 text-brand-600" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {category.title}
                  </span>
                </div>
                <ul className="space-y-0.5">
                  {category.articles.map((article) => {
                    const active =
                      category.slug === currentCategory?.slug &&
                      article.slug === currentArticle?.slug
                    return (
                      <li key={article.slug}>
                        <button
                          onClick={() => openArticle(category.slug, article.slug)}
                          className={cn(
                            'w-full rounded-lg px-3 py-1.5 text-left text-sm transition-colors',
                            active
                              ? 'bg-brand-50 font-medium text-brand-700'
                              : 'text-foreground/80 hover:bg-secondary',
                          )}
                        >
                          {article.title}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </nav>

          {/* Article */}
          {currentArticle && (
            <article className="min-w-0">
              <div className="mb-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <span>{currentCategory?.title}</span>
                <ChevronRight className="h-3.5 w-3.5" />
                <span className="text-foreground">{currentArticle.title}</span>
              </div>
              <h2 className="text-2xl font-semibold tracking-apple-tight">
                {currentArticle.title}
              </h2>
              <p className="mt-1 text-muted-foreground">{currentArticle.summary}</p>
              <div className="mt-6 space-y-4">
                {currentArticle.blocks.map((block, i) => (
                  <Block key={i} block={block} />
                ))}
              </div>
            </article>
          )}
        </div>
      )}
    </div>
  )
}
