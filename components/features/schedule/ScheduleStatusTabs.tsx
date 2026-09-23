'use client'

/**
 * Atalhos rápidos de filtro (issue #9 § 2): Todas · Hoje · Próximos 7 dias ·
 * Com pendências — com contador e estado ativo do Design System. Substitui
 * as antigas tabs de fase (Pré-viagem/Em viagem/Pós-viagem/Concluídas).
 * Extraído de ScheduleClient.tsx.
 */

import { cn } from '@/lib/utils'

export type ScheduleStatusTab = 'all' | 'today' | 'next7' | 'pending'

export function ScheduleStatusTabs({
  value, onChange, counts,
}: {
  value: ScheduleStatusTab
  onChange: (v: ScheduleStatusTab) => void
  counts: { all: number; today: number; next7: number; pending: number }
}) {
  const items = ([
    { id: 'all', label: `Todas (${counts.all})` },
    { id: 'today', label: `Hoje (${counts.today})` },
    { id: 'next7', label: `Próximos 7 dias (${counts.next7})` },
    { id: 'pending', label: `Com pendências (${counts.pending})` },
  ] as const)

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.map(b => (
        <button
          key={b.id}
          type="button"
          onClick={() => onChange(b.id)}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 h-8 rounded-full border text-xs font-medium transition-colors',
            value === b.id
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background hover:bg-muted text-muted-foreground border-border',
          )}
        >
          {b.label}
        </button>
      ))}
    </div>
  )
}
