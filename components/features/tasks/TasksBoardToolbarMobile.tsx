'use client'

/**
 * Seção mobile (abaixo de md) da TasksBoardToolbar — extraída só pra manter
 * o arquivo principal dentro do limite de linhas do lint. Mesmo conteúdo
 * de antes, sem lógica nova.
 */

import { useState, type ReactNode } from 'react'
import { User2, Calendar, Search, X } from 'lucide-react'
import { RELATED_TYPE_LABELS, type RelatedTypeValue } from '@/lib/tasks/related-types'
import { cn } from '@/lib/utils'
import {
  type Member, type PriorityFilter, type AssigneeFilter,
  type StatusFilter, type RelatedFilter, type ViewMode, type ListPeriod,
  GROUPS, PRIORITY_META, FOCUS_RING,
} from './TasksBoardShared'
import { FilterChip } from './TasksBoardCalendarViews'
import { MobileFilterSheet, MobileFilterTrigger } from '@/components/features/mobile/MobileFilterSheet'
import { FilterFields, LIST_PERIODS } from './TasksBoardToolbar'

export function TasksBoardToolbarMobile({
  search, setSearch, currentUserId, onlyMine, setOnlyMine, todayOnly, onClickToday,
  members, assignee, setAssignee, priority, setPriority, statusFilter, setStatusFilter,
  relatedFilter, setRelatedFilter, niche,
  viewMode, listPeriod, setListPeriod, viewToggle,
  activeFilterCount, clearAllFilters,
}: {
  search: string
  setSearch: (v: string) => void
  currentUserId?: string
  onlyMine: boolean
  setOnlyMine: (fn: (v: boolean) => boolean) => void
  todayOnly: boolean
  onClickToday: () => void
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
  viewMode: ViewMode
  listPeriod: ListPeriod
  setListPeriod: (v: ListPeriod) => void
  viewToggle: ReactNode
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
        {viewMode === 'calendar' && (
          <button
            type="button"
            onClick={onClickToday}
            className={cn('inline-flex items-center gap-1 px-2.5 h-9 rounded-pill border text-xs font-medium shrink-0', FOCUS_RING, todayOnly ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border')}
          >
            <Calendar className="w-3.5 h-3.5" /> Hoje
          </button>
        )}
        <MobileFilterTrigger activeCount={activeFilterCount} onClick={() => setMobileFiltersOpenLocal(true)} />
      </div>

      {/* Fixo no mesmo lugar (linha própria) nos dois modos */}
      <div className="flex items-center justify-between gap-2">
        {viewMode === 'list' ? (
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
        ) : <span />}
        {viewToggle}
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
