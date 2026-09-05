'use client'

/**
 * Search/filter toolbar + calendar nav header + active-filter chips for
 * TasksBoard. Prop-driven, split out of TasksBoard.tsx.
 */

import { Button } from '@/components/ui/button'
import { ResponsiveSelect } from '@/components/ui/responsive-select'
import { relatedTypeOptions, RELATED_TYPE_LABELS, type RelatedTypeValue } from '@/lib/tasks/related-types'
import { cn } from '@/lib/utils'
import { User2, Calendar, Search, X, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import {
  type Member, type PriorityFilter, type AssigneeFilter,
  type StatusFilter, type RelatedFilter, type CalView,
  GROUPS, STATUS_OPTIONS, PRIORITY_META, FOCUS_RING,
} from './TasksBoardShared'
import { FilterChip, weekRangeLabel } from './TasksBoardCalendarViews'

export function TasksBoardToolbar({
  search, setSearch, currentUserId, onlyMine, setOnlyMine, todayOnly, onClickToday, onNewTask,
  calView, setCalView, onNavPrev, onNavNext, calMonth, weekDays,
  members, assignee, setAssignee, priority, setPriority, statusFilter, setStatusFilter,
  relatedFilter, setRelatedFilter, niche,
  selectedDay, setSelectedDay, setTodayOnly,
}: {
  search: string
  setSearch: (v: string) => void
  currentUserId?: string
  onlyMine: boolean
  setOnlyMine: (fn: (v: boolean) => boolean) => void
  todayOnly: boolean
  onClickToday: () => void
  onNewTask: () => void
  calView: CalView
  setCalView: (v: CalView) => void
  onNavPrev: () => void
  onNavNext: () => void
  calMonth: Date
  weekDays: Date[]
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
  selectedDay: string | null
  setSelectedDay: (v: string | null) => void
  setTodayOnly: (v: boolean) => void
}) {
  return (
    <>
      {/* Busca + chip "Minhas" + Nova tarefa */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por título ou descrição..."
            className={cn(
              'h-8 w-full rounded-md border border-input bg-input/25 pl-8 pr-7 text-xs placeholder:text-muted-foreground',
              FOCUS_RING,
            )}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Limpar busca"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {currentUserId && (
          <button
            type="button"
            onClick={() => setOnlyMine(v => !v)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 h-8 rounded-full border text-xs font-medium transition-colors shrink-0',
              FOCUS_RING,
              onlyMine
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background hover:bg-muted text-muted-foreground border-border',
            )}
          >
            <User2 className="w-3.5 h-3.5" /> Minhas
          </button>
        )}
        <button
          type="button"
          onClick={onClickToday}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 h-8 rounded-pill border text-xs font-medium transition-colors shrink-0',
            FOCUS_RING,
            todayOnly
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background hover:bg-muted text-muted-foreground border-border',
          )}
        >
          <Calendar className="w-3.5 h-3.5" /> Hoje
        </button>
        <div className="ml-auto">
          <Button size="sm" onClick={onNewTask} className="gap-1.5">
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Nova tarefa</span>
          </Button>
        </div>
      </div>

      {/* Header do calendário: navegação + Mês/Semana + filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onNavPrev}
            className={cn('flex items-center justify-center h-8 w-8 rounded-md border hover:bg-muted transition-colors', FOCUS_RING)}
            aria-label="Anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold min-w-[150px] text-center capitalize">
            {calView === 'month'
              ? calMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
              : weekRangeLabel(weekDays)}
          </span>
          <button
            type="button"
            onClick={onNavNext}
            className={cn('flex items-center justify-center h-8 w-8 rounded-md border hover:bg-muted transition-colors', FOCUS_RING)}
            aria-label="Próximo"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="inline-flex rounded-lg border bg-muted/30 p-0.5">
          {(['month', 'week'] as CalView[]).map(v => (
            <button
              key={v}
              type="button"
              onClick={() => setCalView(v)}
              className={cn(
                'px-3 h-7 rounded-md text-xs font-medium transition-colors',
                FOCUS_RING,
                calView === v ? 'bg-background text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {v === 'month' ? 'Mês' : 'Semana'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {members.length > 0 && (
            <ResponsiveSelect
              className="h-8 w-[170px] text-xs"
              aria-label="Filtrar por responsável"
              value={assignee}
              onValueChange={v => setAssignee(v as AssigneeFilter)}
              options={[
                { value: 'all', label: 'Responsável: Todos' },
                { value: 'none', label: 'Responsável: Sem responsável' },
                ...members.map(m => ({ value: m.user_id, label: `Responsável: ${m.name}` })),
              ]}
            />
          )}
          <ResponsiveSelect
            className="h-8 w-[150px] text-xs"
            aria-label="Filtrar por prioridade"
            value={priority}
            onValueChange={v => setPriority(v as PriorityFilter)}
            options={[
              { value: 'all', label: 'Prioridade: Todas' },
              { value: 'high', label: `Prioridade: ${PRIORITY_META.high.label}` },
              { value: 'normal', label: `Prioridade: ${PRIORITY_META.normal.label}` },
              { value: 'low', label: `Prioridade: ${PRIORITY_META.low.label}` },
            ]}
          />
          <ResponsiveSelect
            className="h-8 w-[150px] text-xs"
            aria-label="Filtrar por status"
            value={statusFilter}
            onValueChange={v => setStatusFilter(v as StatusFilter)}
            options={STATUS_OPTIONS.map(o => ({ value: o.value, label: o.value === 'all' ? 'Status: Todos' : `Status: ${o.label}` }))}
          />
          <ResponsiveSelect
            className="h-8 w-[180px] text-xs"
            aria-label="Filtrar por relacionado a"
            value={relatedFilter}
            onValueChange={v => setRelatedFilter(v as RelatedFilter)}
            options={[
              { value: 'all', label: 'Relacionado a: Todos' },
              ...relatedTypeOptions(niche).map(o => ({ value: o.value, label: `Relacionado a: ${o.label}` })),
            ]}
          />
        </div>
      </div>

      {/* Chips de filtros ativos — cada × zera só aquele filtro */}
      {(priority !== 'all' || assignee !== 'all' || statusFilter !== 'all' || relatedFilter !== 'all' || onlyMine || todayOnly || selectedDay) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {selectedDay && (
            <FilterChip label={`Dia: ${new Date(selectedDay + 'T00:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: 'short' })}`} onClear={() => setSelectedDay(null)} />
          )}
          {todayOnly && <FilterChip label="Hoje" onClear={() => setTodayOnly(false)} />}
          {onlyMine && <FilterChip label="Minhas" onClear={() => setOnlyMine(() => false)} />}
          {priority !== 'all' && <FilterChip label={`Prioridade: ${PRIORITY_META[priority].label}`} onClear={() => setPriority('all')} />}
          {assignee !== 'all' && (
            <FilterChip
              label={`Responsável: ${assignee === 'none' ? 'Sem responsável' : (members.find(m => m.user_id === assignee)?.name ?? '—')}`}
              onClear={() => setAssignee('all')}
            />
          )}
          {statusFilter !== 'all' && <FilterChip label={`Status: ${GROUPS.find(g => g.id === statusFilter)?.label ?? statusFilter}`} onClear={() => setStatusFilter('all')} />}
          {relatedFilter !== 'all' && (
            <FilterChip
              label={`Relacionado a: ${RELATED_TYPE_LABELS[relatedFilter as RelatedTypeValue] ?? relatedFilter}`}
              onClear={() => setRelatedFilter('all')}
            />
          )}
        </div>
      )}
    </>
  )
}
