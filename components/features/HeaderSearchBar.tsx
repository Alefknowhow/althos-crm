'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Command as CommandPrimitive } from 'cmdk'
import { Search, Star, User as UserIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { searchEverything, type SearchHit } from '@/actions/search'
import { getGlobalNavEntries } from '@/lib/nav-entries'

/** Barra de pesquisa global do header desktop — busca acontece direto nela
 *  (sem abrir modal): foco abre um painel flutuante com os resultados,
 *  digitar já filtra lead/cliente (busca no servidor) e destinos do CRM
 *  (filtro local do cmdk). O command palette em modal (⌘K) continua existindo
 *  à parte, para o atalho de teclado e o botão "Consultar" do mobile. */
export function HeaderSearchBar({ orgSlug }: { orgSlug: string }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [, startTransition] = useTransition()
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setHits([])
      return
    }
    const t = setTimeout(() => {
      startTransition(async () => {
        try {
          setHits(await searchEverything(orgSlug, q))
        } catch {
          setHits([])
        }
      })
    }, 180)
    return () => clearTimeout(t)
  }, [query, orgSlug])

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  const navEntries = getGlobalNavEntries(`/app/${orgSlug}`)

  function go(href: string) {
    setOpen(false)
    setQuery('')
    router.push(href)
  }

  return (
    <div ref={containerRef} className="hidden md:block relative w-full max-w-[360px]">
      <CommandPrimitive className="w-full overflow-visible bg-transparent">
        <div className="flex items-center gap-2 h-9 w-full px-3 rounded-full bg-muted/70 focus-within:bg-muted transition-colors">
          <Search className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
          <CommandPrimitive.Input
            value={query}
            onValueChange={setQuery}
            onFocus={() => setOpen(true)}
            placeholder="Pesquisar qualquer coisa..."
            aria-label="Pesquisar qualquer coisa — lead, cliente, módulo ou ação"
            className="flex-1 min-w-0 bg-transparent outline-none text-[13px] placeholder:text-muted-foreground"
          />
        </div>

        {open && (
          <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 rounded-xl border border-border bg-popover text-popover-foreground shadow-lg overflow-hidden">
            <CommandPrimitive.List className="max-h-[360px] overflow-y-auto overflow-x-hidden p-1">
              <CommandPrimitive.Empty className="py-6 text-center text-sm text-muted-foreground">
                {query.trim().length < 2 ? 'Digite ao menos 2 caracteres.' : 'Nada encontrado.'}
              </CommandPrimitive.Empty>

              {hits.length > 0 && (
                <CommandPrimitive.Group
                  heading="Resultados"
                  className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
                >
                  {hits.map(h => {
                    const Icon = h.kind === 'customer' ? Star : UserIcon
                    return (
                      <CommandPrimitive.Item
                        key={`${h.kind}-${h.id}`}
                        value={`${h.title} ${h.subtitle || ''} ${h.kind}`}
                        onSelect={() => go(h.href)}
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm cursor-pointer data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                      >
                        <Icon className={cn('w-4 h-4 shrink-0', h.kind === 'customer' ? 'text-amber-500' : 'text-muted-foreground')} />
                        <div className="flex flex-col min-w-0">
                          <span className="truncate">{h.title}</span>
                          {h.subtitle && <span className="text-xs text-muted-foreground truncate">{h.subtitle}</span>}
                        </div>
                      </CommandPrimitive.Item>
                    )
                  })}
                </CommandPrimitive.Group>
              )}

              <CommandPrimitive.Group
                heading="Ir para"
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {navEntries.map(n => {
                  const Icon = n.icon
                  return (
                    <CommandPrimitive.Item
                      key={n.href}
                      value={`${n.label} ${n.keywords || ''}`}
                      onSelect={() => go(n.href)}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm cursor-pointer data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                    >
                      <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
                      <span>{n.label}</span>
                    </CommandPrimitive.Item>
                  )
                })}
              </CommandPrimitive.Group>
            </CommandPrimitive.List>
          </div>
        )}
      </CommandPrimitive>
    </div>
  )
}
