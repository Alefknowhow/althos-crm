'use client'

/**
 * Barra de controles do módulo Tarefas — reformulada guiada pelos 2
 * anexos do pedido (modo Calendário / modo Lista):
 *  1. Cabeçalho: contagem "X atrasada · Y para hoje" + botão "Nova tarefa".
 *  2. Busca + "Minhas tarefas" (select) + "Filtros" (popover com badge).
 *  3. Barra de controles fixa: à esquerda, navegação de calendário (modo
 *     Calendário) OU abas de período (modo Lista); à direita, SEMPRE na
 *     mesma posição nos dois modos, o toggle Lista/Calendário — e, só no
 *     modo Calendário, o toggle Mês/Semana ao lado dele (pedido explícito:
 *     o toggle Lista/Calendário não pode mudar de lugar entre os modos).
 */

import { ActionButton as Button } from '@/components/features/ActionButton'
import { ResponsiveSelect } from '@/components/ui/responsive-select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { relatedTypeOptions } from '@/lib/tasks/related-types'
import { cn } from '@/lib/utils'
import { CalendarDays, List, Search, X, Plus, AlertCircle, SlidersHorizontal } from 'lucide-react'
import {
  type Member, type PriorityFilter, type AssigneeFilter,
  type StatusFilter, type RelatedFilter, type CalView, type ViewMode, type ListPeriod,
  STATUS_OPTIONS, PRIORITY_META, FOCUS_RING,
} from './TasksBoardShared'
import { TasksBoardToolbarMobile } from './TasksBoardToolbarMobile'
import { TasksBoardControlsRow } from './TasksBoardControlsRow'

export const LIST_PERIODS: { id: ListPeriod; label: string }[] = [
  { id: 'today', label: 'Hoje' },
  { id: 'week', label: 'Esta semana' },
  { id: 'month', label: 'Este mês' },
  { id: 'all', label: 'Todas' },
]

/** Conteúdo dos 4 filtros — compartilhado entre o popover desktop e o sheet mobile. */
export function FilterFields({
  members, assignee, setAssignee, priority, setPriority, statusFilter, setStatusFilter,
  relatedFilter, setRelatedFilter, niche, size = 'default', inline = false,
}: {
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
  size?: 'default' | 'mobile'
  /** Direto na barra de controles (não dentro de popover/sheet) — largura
   *  fixa e compacta em vez de esticar 100% do container. */
  inline?: boolean
}) {
  const cls = inline ? 'h-8 w-[150px] text-xs shrink-0' : size === 'mobile' ? 'h-11 w-full text-sm' : 'h-8 w-full text-xs'
  return (
    <>
      {members.length > 0 && (
        <ResponsiveSelect
          className={cls}
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
        className={cls}
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
        className={cls}
        aria-label="Filtrar por status"
        value={statusFilter}
        onValueChange={v => setStatusFilter(v as StatusFilter)}
        options={STATUS_OPTIONS.map(o => ({ value: o.value, label: o.value === 'all' ? 'Status: Todos' : `Status: ${o.label}` }))}
      />
      <ResponsiveSelect
        className={cls}
        aria-label="Filtrar por relacionado a"
        value={relatedFilter}
        onValueChange={v => setRelatedFilter(v as RelatedFilter)}
        options={[
          { value: 'all', label: 'Relacionado a: Todos' },
          ...relatedTypeOptions(niche).map(o => ({ value: o.value, label: `Relacionado a: ${o.label}` })),
        ]}
      />
    </>
  )
}

export function TasksBoardToolbar({
  search, setSearch, currentUserId, onlyMine, setOnlyMine, todayOnly, onClickToday, onNewTask,
  calView, setCalView, onNavPrev, onNavNext, calMonth, weekDays,
  members, assignee, setAssignee, priority, setPriority, statusFilter, setStatusFilter,
  relatedFilter, setRelatedFilter, niche,
  selectedDay, setSelectedDay,
  viewMode, setViewMode, listPeriod, setListPeriod,
  overdueCount, todayCount,
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
  viewMode: ViewMode
  setViewMode: (v: ViewMode) => void
  listPeriod: ListPeriod
  setListPeriod: (v: ListPeriod) => void
  overdueCount: number
  todayCount: number
}) {
  const activeFilterCount = [priority !== 'all', assignee !== 'all', statusFilter !== 'all', relatedFilter !== 'all'].filter(Boolean).length

  function clearAllFilters() {
    setAssignee('all'); setPriority('all'); setStatusFilter('all'); setRelatedFilter('all')
  }

  // Toggle Lista/Calendário — MESMO componente nos dois lugares (desktop e
  // mobile) e sempre no mesmo ponto da barra (extremo direito da 2ª linha),
  // pra nunca "pular de lugar" quando o modo muda (pedido explícito).
  const ViewToggle = (
    <div className="inline-flex rounded-lg border bg-muted/30 p-0.5 shrink-0">
      <button
        type="button"
        onClick={() => setViewMode('list')}
        className={cn('inline-flex items-center gap-1.5 px-3 h-7 rounded-md text-xs font-medium transition-colors', FOCUS_RING,
          viewMode === 'list' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
      >
        <List className="w-3.5 h-3.5" /> Lista
      </button>
      <button
        type="button"
        onClick={() => setViewMode('calendar')}
        className={cn('inline-flex items-center gap-1.5 px-3 h-7 rounded-md text-xs font-medium transition-colors', FOCUS_RING,
          viewMode === 'calendar' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
      >
        <CalendarDays className="w-3.5 h-3.5" /> Calendário
      </button>
    </div>
  )

  return (
    <>
      {/* ── Cabeçalho: contagem + Nova tarefa (mesmo em mobile e desktop) ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          {overdueCount > 0 && (
            <span className="inline-flex items-center gap-1 font-medium text-destructive mr-2">
              <AlertCircle className="w-3.5 h-3.5" /> {overdueCount} atrasada{overdueCount !== 1 ? 's' : ''}
            </span>
          )}
          <span className="text-muted-foreground">
            {overdueCount > 0 && '· '}{todayCount} para hoje
          </span>
        </div>
        <Button onClick={onNewTask} aria-label="Nova tarefa">
          <Plus className="w-4 h-4" /> Nova tarefa
        </Button>
      </div>

      {/* ── Mobile (abaixo de md) ──────────────────────────────────────── */}
      <TasksBoardToolbarMobile
        search={search} setSearch={setSearch}
        currentUserId={currentUserId}
        onlyMine={onlyMine} setOnlyMine={setOnlyMine}
        todayOnly={todayOnly} onClickToday={onClickToday}
        members={members}
        assignee={assignee} setAssignee={setAssignee}
        priority={priority} setPriority={setPriority}
        statusFilter={statusFilter} setStatusFilter={setStatusFilter}
        relatedFilter={relatedFilter} setRelatedFilter={setRelatedFilter}
        niche={niche}
        viewMode={viewMode} listPeriod={listPeriod} setListPeriod={setListPeriod}
        viewToggle={ViewToggle}
        activeFilterCount={activeFilterCount}
        clearAllFilters={clearAllFilters}
      />

      {/* ── Desktop (md+) ──────────────────────────────────────────────── */}
      <div className="hidden md:block space-y-2">
        {/* Busca + Minhas tarefas + Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por título ou descrição..."
              className={cn('h-8 w-full rounded-md border border-input bg-input/25 pl-8 pr-7 text-xs placeholder:text-muted-foreground', FOCUS_RING)}
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} aria-label="Limpar busca" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {currentUserId && (
            <ResponsiveSelect
              className="h-8 w-[170px] text-xs shrink-0"
              aria-label="Minhas tarefas ou todas"
              value={onlyMine ? 'mine' : 'all'}
              onValueChange={v => setOnlyMine(() => v === 'mine')}
              options={[
                { value: 'mine', label: 'Minhas tarefas' },
                { value: 'all', label: 'Todas as tarefas' },
              ]}
            />
          )}

          {/* Filtros organizados num único botão "Filtros" (regra geral do
              /design) — antes ficavam soltos direto na barra. */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn('inline-flex h-9 items-center gap-1.5 rounded-full bg-card px-3.5 text-[13px] font-medium shadow-[0_1px_2px_rgba(0,0,0,.05)] shrink-0', FOCUS_RING)}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Filtros
                {activeFilterCount > 0 && (
                  <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 space-y-2">
              <FilterFields
                members={members} assignee={assignee} setAssignee={setAssignee}
                priority={priority} setPriority={setPriority}
                statusFilter={statusFilter} setStatusFilter={setStatusFilter}
                relatedFilter={relatedFilter} setRelatedFilter={setRelatedFilter}
                niche={niche}
              />
              {activeFilterCount > 0 && (
                <button type="button" onClick={clearAllFilters} className={cn('text-xs text-primary hover:underline', FOCUS_RING)}>
                  Limpar filtros
                </button>
              )}
            </PopoverContent>
          </Popover>
        </div>

        {/* Barra de controles fixa: nav/abas à esquerda, view+período à
            direita — o toggle Lista/Calendário fica sempre no mesmo lugar
            (extremo direito), nos dois modos. */}
        <TasksBoardControlsRow
          viewMode={viewMode} calView={calView} setCalView={setCalView}
          onNavPrev={onNavPrev} onNavNext={onNavNext} calMonth={calMonth} weekDays={weekDays}
          onClickToday={onClickToday} todayOnly={todayOnly}
          listPeriod={listPeriod} setListPeriod={setListPeriod}
          selectedDay={selectedDay} setSelectedDay={setSelectedDay}
          viewToggle={ViewToggle}
        />
      </div>
    </>
  )
}
