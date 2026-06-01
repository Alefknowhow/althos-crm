'use client'

import { useCallback, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Search, X, Loader2 } from 'lucide-react'

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'Todos os status' },
  { value: 'running', label: 'Em andamento' },
  { value: 'completed', label: 'Concluída' },
  { value: 'failed', label: 'Falhou' },
  { value: 'cancelled', label: 'Cancelada' },
]

export default function LogsFilters({
  orgSlug,
  automations,
  current,
}: {
  orgSlug: string
  automations: Array<{ id: string; name: string }>
  current: {
    status: string
    automationId: string
    search: string
    from: string
    to: string
  }
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [search, setSearch] = useState(current.search)

  // Build a new URL preserving existing params, resetting to page 1 on filter change.
  const push = useCallback(
    (patch: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(patch)) {
        if (value == null || value === '' || value === 'all') params.delete(key)
        else params.set(key, value)
      }
      params.delete('page') // any filter change returns to first page
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`)
      })
    },
    [router, pathname, searchParams],
  )

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    push({ search: search.trim() || null })
  }

  const hasFilters =
    !!current.search ||
    (current.status && current.status !== 'all') ||
    (current.automationId && current.automationId !== 'all') ||
    !!current.from ||
    !!current.to

  return (
    <div className="flex flex-wrap items-end gap-2">
      {/* Lead search */}
      <form onSubmit={submitSearch} className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar lead (nome/e-mail)"
          className="h-9 w-56 pl-8 text-sm"
        />
      </form>

      {/* Automation */}
      <Select
        value={current.automationId || 'all'}
        onValueChange={v => push({ automationId: v })}
      >
        <SelectTrigger className="h-9 w-52 text-sm">
          <SelectValue placeholder="Automação" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as automações</SelectItem>
          {automations.map(a => (
            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Status */}
      <Select value={current.status || 'all'} onValueChange={v => push({ status: v })}>
        <SelectTrigger className="h-9 w-44 text-sm">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map(o => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Period */}
      <div className="flex items-center gap-1.5">
        <Input
          type="date"
          value={current.from}
          onChange={e => push({ from: e.target.value || null })}
          className="h-9 w-[140px] text-sm"
          aria-label="De"
        />
        <span className="text-muted-foreground text-xs">até</span>
        <Input
          type="date"
          value={current.to}
          onChange={e => push({ to: e.target.value || null })}
          className="h-9 w-[140px] text-sm"
          aria-label="Até"
        />
      </div>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 text-muted-foreground"
          onClick={() => {
            setSearch('')
            startTransition(() => router.push(pathname))
          }}
        >
          <X className="w-3.5 h-3.5 mr-1" /> Limpar
        </Button>
      )}

      {pending && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground self-center" />}
    </div>
  )
}
