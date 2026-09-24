'use client'

/**
 * Seção mobile (abaixo de md) da TasksBoardToolbar — extraída só pra manter
 * o arquivo principal dentro do limite de linhas do lint. Só lista (sem
 * calendário — isso é Agenda → Eventos agora).
 */

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { User2, Search, X } from 'lucide-react'
import { RELATED_TYPE_LABELS, type RelatedTypeValue } from '@/lib/tasks/related-types'
import { cn } from '@/lib/utils'
import {
  type Member, type PriorityFilter, type AssigneeFilter,
  type StatusFilter, type RelatedFilter, type ListPeriod,
  GROUPS, PRIORITY_META, FOCUS_RING,
} from './TasksBoardShared'
import { MobileFilterSheet, MobileFilterTrigger } from '@/components/features/mobile/MobileFilterSheet'
import { FilterFields, LIST_PERIODS } from './TasksBoardToolbar'

/** Badge de filtro ativo removível — só usado aqui (mobile); sem mais
 *  consumidor de calendário pra justificar um arquivo compartilhado. */
function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <Badge variant="secondary" className="gap-1 pr-1 font-normal">
      {label}
      <button
        type="button"
        onClick={onClear}
        aria-label={`Remover filtro: ${label}`}
        className="rounded-full hover:bg-muted-foreground/20 p-0.5"
      >
        <X className="w-3 h-3" />
      </button>
    </Badge>
  )
}

export function TasksBoardToolbarMobile({
  search, setSearch, currentUserId, onlyMine, setOnlyMine,
  members, assignee, setAssignee, priority, setPriority, statusFilter, setStatusFilter,
  relatedFilter, setRelatedFilter, niche,
  listPeriod, setListPeriod,
  activeFilterCount, clearAllFilters,
}: {
  search: string
  setSearch: (v: string) => void
  currentUserId?: string
  onlyMine: boolean
  setOnlyMine: (fn: (v: boolean) => boolean) => void
  members: Member[]
  assignee: AssigneeFilter
  setAssignee: (v: AssigneeFilter) => void
  priority: PriorityFilter
  setPriority: (v: PriorityFilter) => void
  statusFilter: StatusFilter
  setStatusFilter: (v: StatusFilter) => void
  relatedFilter: RelatedFilter
  setRelatedFilter: (v: RelatedFilter) => void
  niche?: string | null
  listPeriod: ListPeriod
  setListPeriod: (v: ListPeriod) => void
  activeFilterCount: number
  clearAllFilters: () => void
}) {
  const [mobileFiltersOpen, setMobileFiltersOpenLocal] = useState(false)

  return (
    <div className="md:hidden space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar tarefa..."
          className={cn('h-10 w-full rounded-md border border-input bg-input/25 pl-8 pr-7 text-sm placeholder:text-muted-foreground', FOCUS_RING)}
        />
        {search && (
          <button type="button" onClick={() => setSearch('')} aria-label="Limpar busca" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        {currentUserId && (
          <button
            type="button"
            onClick={() => setOnlyMine(v => !v)}
            className={cn('inline-flex items-center gap-1 px-2.5 h-9 rounded-full border text-xs font-medium shrink-0', FOCUS_RING, onlyMine ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border')}
          >
            <User2 className="w-3.5 h-3.5" /> Minhas
          </button>
        )}
        <MobileFilterTrigger activeCount={activeFilterCount} onClick={() => setMobileFiltersOpenLocal(true)} />
      </div>

      <div className="flex items-center gap-1 overflow-x-auto">
        {LIST_PERIODS.map(p => (
          <button
            key={p.id}
            type="button"
            onClick={() => setListPeriod(p.id)}
            className={cn('px-2.5 h-8 rounded-md text-xs font-medium shrink-0', FOCUS_RING,
              listPeriod === p.id ? 'bg-primary text-primary-foreground' : 'bg-muted/40 text-muted-foreground')}
          >
            {p.label}
          </button>
        ))}
      </div>

      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {priority !== 'all' && <FilterChip label={`Prioridade: ${PRIORITY_META[priority].label}`} onClear={() => setPriority('all')} />}
          {assignee !== 'all' && (
            <FilterChip label={`Responsável: ${assignee === 'none' ? 'Sem responsável' : (members.find(m => m.user_id === assignee)?.name ?? '—')}`} onClear={() => setAssignee('all')} />
          )}
          {statusFilter !== 'all' && <FilterChip label={`Status: ${GROUPS.find(g => g.id === statusFilter)?.label ?? statusFilter}`} onClear={() => setStatusFilter('all')} />}
          {relatedFilter !== 'all' && (
            <FilterChip label={`Relacionado a: ${RELATED_TYPE_LABELS[relatedFilter as RelatedTypeValue] ?? relatedFilter}`} onClear={() => setRelatedFilter('all')} />
          )}
        </div>
      )}

      <MobileFilterSheet
        open={mobileFiltersOpen}
        onOpenChange={setMobileFiltersOpenLocal}
        activeCount={activeFilterCount}
        onApply={() => {}}
        onClear={clearAllFilters}
      >
        <FilterFields
          members={members} assignee={assignee} setAssignee={setAssignee}
          priority={priority} setPriority={setPriority}
          statusFilter={statusFilter} setStatusFilter={setStatusFilter}
          relatedFilter={relatedFilter} setRelatedFilter={setRelatedFilter}
          niche={niche} size="mobile"
        />
      </MobileFilterSheet>
    </div>
  )
}
