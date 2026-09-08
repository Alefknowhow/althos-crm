'use client'

/**
 * Filter/sort/view toolbar for KanbanBoard. Prop-driven, split out of
 * KanbanBoard.tsx.
 *
 * Mobile (<md): só a busca fica solta; o resto dos filtros (responsável,
 * temperatura, ordenação, "parados", limpar) fica dentro de um popover de
 * ícone — evita a fileira de 6 controles quebrando em várias linhas.
 * Desktop (md+): tudo em linha, como sempre foi.
 */

import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Search, AlarmClock, X, LayoutGrid, List, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

type Member = { id: string; name: string; email: string }
type SortKey = 'recent' | 'value_desc' | 'name'

type FilterFieldsProps = {
  members: Member[]
  ownerFilter: string
  setOwnerFilter: (v: string) => void
  tierFilter: string
  setTierFilter: (v: string) => void
  sortKey: SortKey
  setSortKey: (v: SortKey) => void
  stalledOnly: boolean
  setStalledOnly: (fn: (v: boolean) => boolean) => void
  filtersActive: boolean
  clearFilters: () => void
}

function FilterFields({
  members, ownerFilter, setOwnerFilter, tierFilter, setTierFilter,
  sortKey, setSortKey, stalledOnly, setStalledOnly, filtersActive, clearFilters,
}: FilterFieldsProps) {
  return (
    <>
      {members.length > 0 && (
        <Select value={ownerFilter} onValueChange={setOwnerFilter}>
          <SelectTrigger className="h-9 w-full md:w-[150px]"><SelectValue placeholder="Responsável" /></SelectTrigger>
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
        <SelectTrigger className="h-9 w-full md:w-[130px]"><SelectValue placeholder="Temperatura" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas IA</SelectItem>
          <SelectItem value="hot">🔥 Quente</SelectItem>
          <SelectItem value="warm">🟡 Morno</SelectItem>
          <SelectItem value="cold">🔵 Frio</SelectItem>
        </SelectContent>
      </Select>

      <Select value={sortKey} onValueChange={v => setSortKey(v as SortKey)}>
        <SelectTrigger className="h-9 w-full md:w-[150px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="recent">Mais recentes</SelectItem>
          <SelectItem value="value_desc">Maior valor</SelectItem>
          <SelectItem value="name">Nome (A-Z)</SelectItem>
        </SelectContent>
      </Select>

      <button
        type="button"
        onClick={() => setStalledOnly(v => !v)}
        className={cn(
          'inline-flex h-9 items-center justify-center gap-1.5 rounded-md border px-3 text-sm transition-colors w-full md:w-auto',
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
          className="inline-flex h-9 items-center justify-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground w-full md:w-auto"
        >
          <X className="h-4 w-4" />
          Limpar
        </button>
      )}
    </>
  )
}

export function KanbanBoardToolbar(props: {
  toolbarStart?: React.ReactNode
  view: 'board' | 'list'
  setView: (v: 'board' | 'list') => void
  search: string
  setSearch: (v: string) => void
} & FilterFieldsProps) {
  const { toolbarStart, view, setView, search, setSearch, filtersActive } = props

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

      {/* Busca — sempre visível, único controle solto no mobile */}
      <div className="relative min-w-[140px] flex-1 max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar negócios…"
          className="h-9 pl-9"
        />
      </div>

      {/* Mobile: resto dos filtros dentro de um popover de ícone */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'md:hidden relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors',
              filtersActive ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-secondary',
            )}
            aria-label="Mais filtros"
          >
            <SlidersHorizontal className="h-4 w-4" />
            {filtersActive && <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary" />}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 space-y-2 md:hidden">
          <FilterFields {...props} />
        </PopoverContent>
      </Popover>

      {/* Desktop: tudo em linha, como sempre foi */}
      <div className="hidden md:flex md:flex-wrap md:items-center md:gap-2">
        <FilterFields {...props} />
      </div>
    </div>
  )
}
