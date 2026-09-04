'use client'

/**
 * Filter/sort/view toolbar for KanbanBoard. Prop-driven, split out of
 * KanbanBoard.tsx.
 */

import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, AlarmClock, X, LayoutGrid, List } from 'lucide-react'
import { cn } from '@/lib/utils'

type Member = { id: string; name: string; email: string }
type SortKey = 'recent' | 'value_desc' | 'name'

export function KanbanBoardToolbar({
  toolbarStart, view, setView, members, ownerFilter, setOwnerFilter,
  tierFilter, setTierFilter, sortKey, setSortKey, search, setSearch,
  stalledOnly, setStalledOnly, filtersActive, clearFilters,
}: {
  toolbarStart?: React.ReactNode
  view: 'board' | 'list'
  setView: (v: 'board' | 'list') => void
  members: Member[]
  ownerFilter: string
  setOwnerFilter: (v: string) => void
  tierFilter: string
  setTierFilter: (v: string) => void
  sortKey: SortKey
  setSortKey: (v: SortKey) => void
  search: string
  setSearch: (v: string) => void
  stalledOnly: boolean
  setStalledOnly: (fn: (v: boolean) => boolean) => void
  filtersActive: boolean
  clearFilters: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {toolbarStart}

      {/* Board / list view toggle — desktop only (mobile uses the stage accordion) */}
      <div className="hidden md:inline-flex h-9 items-center rounded-md border border-border p-0.5">
        <button
          type="button"
          onClick={() => setView('board')}
          title="Visualizar em quadro"
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-sm transition-colors',
            view === 'board' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <LayoutGrid className="h-4 w-4" />
          <span className="hidden sm:inline">Quadro</span>
        </button>
        <button
          type="button"
          onClick={() => setView('list')}
          title="Visualizar em lista"
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-sm transition-colors',
            view === 'list' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <List className="h-4 w-4" />
          <span className="hidden sm:inline">Lista</span>
        </button>
      </div>

      {members.length > 0 && (
        <Select value={ownerFilter} onValueChange={setOwnerFilter}>
          <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Responsável" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos responsáveis</SelectItem>
            <SelectItem value="unassigned">Sem responsável</SelectItem>
            {members.map(m => (
              <SelectItem key={m.id} value={m.id}>{m.name || m.email}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Select value={tierFilter} onValueChange={setTierFilter}>
        <SelectTrigger className="h-9 w-[130px]"><SelectValue placeholder="Temperatura" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas IA</SelectItem>
          <SelectItem value="hot">🔥 Quente</SelectItem>
          <SelectItem value="warm">🟡 Morno</SelectItem>
          <SelectItem value="cold">🔵 Frio</SelectItem>
        </SelectContent>
      </Select>

      <Select value={sortKey} onValueChange={v => setSortKey(v as SortKey)}>
        <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="recent">Mais recentes</SelectItem>
          <SelectItem value="value_desc">Maior valor</SelectItem>
          <SelectItem value="name">Nome (A-Z)</SelectItem>
        </SelectContent>
      </Select>

      <div className="relative min-w-[180px] flex-1 max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar negócios…"
          className="h-9 pl-9"
        />
      </div>

      <button
        type="button"
        onClick={() => setStalledOnly(v => !v)}
        className={cn(
          'inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors',
          stalledOnly
            ? 'border-amber-300 bg-amber-50 text-amber-700'
            : 'border-border text-muted-foreground hover:bg-secondary',
        )}
      >
        <AlarmClock className="h-4 w-4" />
        Parados
      </button>

      {filtersActive && (
        <button
          type="button"
          onClick={clearFilters}
          className="inline-flex h-9 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
          Limpar
        </button>
      )}
    </div>
  )
}
