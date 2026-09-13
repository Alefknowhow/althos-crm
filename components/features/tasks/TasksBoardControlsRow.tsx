'use client'

/**
 * Barra de controles fixa (desktop) do TasksBoardToolbar — nav/abas de
 * período à esquerda, view+período à direita, com o toggle Lista/Calendário
 * sempre no extremo direito (pedido explícito: não pode mudar de lugar
 * entre os modos). Extraído só pra manter TasksBoardToolbar.tsx dentro do
 * limite de linhas do lint.
 */

import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type CalView, type ViewMode, type ListPeriod, FOCUS_RING } from './TasksBoardShared'
import { FilterChip, weekRangeLabel } from './TasksBoardCalendarViews'
import { LIST_PERIODS } from './TasksBoardToolbar'

export function TasksBoardControlsRow({
  viewMode, calView, setCalView, onNavPrev, onNavNext, calMonth, weekDays,
  onClickToday, todayOnly, listPeriod, setListPeriod,
  selectedDay, setSelectedDay, viewToggle,
}: {
  viewMode: ViewMode
  calView: CalView
  setCalView: (v: CalView) => void
  onNavPrev: () => void
  onNavNext: () => void
  calMonth: Date
  weekDays: Date[]
  onClickToday: () => void
  todayOnly: boolean
  listPeriod: ListPeriod
  setListPeriod: (v: ListPeriod) => void
  selectedDay: string | null
  setSelectedDay: (v: string | null) => void
  viewToggle: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {viewMode === 'calendar' ? (
        <>
          <div className="flex items-center gap-1">
            <button type="button" onClick={onNavPrev} className={cn('flex items-center justify-center h-8 w-8 rounded-md border hover:bg-muted transition-colors', FOCUS_RING)} aria-label="Anterior">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold min-w-[150px] text-center capitalize">
              {calView === 'month'
                ? calMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
                : weekRangeLabel(weekDays)}
            </span>
            <button type="button" onClick={onNavNext} className={cn('flex items-center justify-center h-8 w-8 rounded-md border hover:bg-muted transition-colors', FOCUS_RING)} aria-label="Próximo">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={onClickToday}
            className={cn('inline-flex items-center gap-1.5 px-3 h-8 rounded-pill border text-xs font-medium transition-colors shrink-0', FOCUS_RING,
              todayOnly ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted text-muted-foreground border-border')}
          >
            Hoje
          </button>
        </>
      ) : (
        <div className="inline-flex rounded-lg border bg-muted/30 p-0.5">
          {LIST_PERIODS.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => setListPeriod(p.id)}
              className={cn('px-3 h-7 rounded-md text-xs font-medium transition-colors', FOCUS_RING,
                listPeriod === p.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {selectedDay && (
        <FilterChip
          label={`Dia: ${new Date(selectedDay + 'T00:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: 'short' })}`}
          onClear={() => setSelectedDay(null)}
        />
      )}

      <div className="ml-auto flex items-center gap-2">
        {viewMode === 'calendar' && (
          <div className="inline-flex rounded-lg border bg-muted/30 p-0.5">
            {(['month', 'week'] as CalView[]).map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setCalView(v)}
                className={cn('px-3 h-7 rounded-md text-xs font-medium transition-colors', FOCUS_RING,
                  calView === v ? 'bg-background text-foreground' : 'text-muted-foreground hover:text-foreground')}
              >
                {v === 'month' ? 'Mês' : 'Semana'}
              </button>
            ))}
          </div>
        )}
        {viewToggle}
      </div>
    </div>
  )
}
