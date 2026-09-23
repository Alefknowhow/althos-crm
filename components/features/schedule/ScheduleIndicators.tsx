'use client'

/**
 * Painel de indicadores — 4 cards pequenos (descrição + número clicável)
 * posicionados ao lado do botão "Mais filtros" na barra de Embarques.
 * Substitui os atalhos em formato de botão (Todas/Hoje/Próximos 7 dias/Com
 * pendências) por um painel onde o foco visual é o número, não o botão —
 * clicar no número aplica o filtro correspondente (clicar de novo no já
 * ativo volta pra "Todas").
 */

import { cn } from '@/lib/utils'
import type { ScheduleQuickView } from './useScheduleFilters'

const CARDS: { id: ScheduleQuickView; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'week', label: 'Essa semana' },
  { id: 'month', label: 'Esse mês' },
  { id: 'pending', label: 'Pendências' },
]

export function ScheduleIndicators({
  value, onChange, counts,
}: {
  value: ScheduleQuickView
  onChange: (v: ScheduleQuickView) => void
  counts: Record<ScheduleQuickView, number>
}) {
  return (
    <div className="flex items-stretch gap-1.5">
      {CARDS.map(card => {
        const active = value === card.id
        return (
          <button
            key={card.id}
            type="button"
            onClick={() => onChange(active ? 'all' : card.id)}
            aria-pressed={active}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 rounded-md border px-3 py-1 min-w-[76px] transition-colors',
              active ? 'border-primary bg-primary/10' : 'border-border bg-card hover:bg-muted/60',
            )}
          >
            <span className={cn('text-base font-bold tabular-nums leading-none', active ? 'text-primary' : 'text-foreground')}>
              {counts[card.id]}
            </span>
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">{card.label}</span>
          </button>
        )
      })}
    </div>
  )
}
