'use client'

/**
 * Tabs rápidas de status (Todas/Pré-viagem/Em viagem/Pós-viagem/Concluídas/
 * Com alertas) do painel de Gestão de Viagens. Extraído de
 * ScheduleClient.tsx.
 */

import { cn } from '@/lib/utils'
import { AlertTriangle } from 'lucide-react'
import type { TripPhase } from './schedule-phase'

export type ScheduleStatusTab = 'all' | TripPhase | 'alerts'

export function ScheduleStatusTabs({
  value, onChange, counts,
}: {
  value: ScheduleStatusTab
  onChange: (v: ScheduleStatusTab) => void
  counts: { all: number; pre: number; em: number; pos: number; concluida: number; alerts: number }
}) {
  const items = ([
    { id: 'all', label: `Todas (${counts.all})` },
    { id: 'pre', label: `Pré-viagem (${counts.pre})` },
    { id: 'em', label: `Em viagem (${counts.em})` },
    { id: 'pos', label: `Pós-viagem (${counts.pos})` },
    { id: 'concluida', label: `Concluídas (${counts.concluida})` },
    { id: 'alerts', label: `Com alertas (${counts.alerts})` },
  ] as const)

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.map(b => (
        <button
          key={b.id}
          onClick={() => onChange(b.id)}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 h-8 rounded-full border text-xs font-medium transition-colors',
            value === b.id
              ? (b.id === 'alerts' ? 'bg-destructive text-destructive-foreground border-destructive' : 'bg-primary text-primary-foreground border-primary')
              : 'bg-background hover:bg-muted text-muted-foreground border-border',
          )}
        >
          {b.id === 'alerts' && <AlertTriangle className="w-3.5 h-3.5" />}
          {b.label}
        </button>
      ))}
    </div>
  )
}
