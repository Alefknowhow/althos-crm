'use client'

/**
 * List view for ScheduleClient — tabela compacta (1 linha por viagem),
 * fiel ao mockup de Gestão de Viagens. Prop-driven, split out of
 * ScheduleClient.tsx.
 */

import type { ScheduledTrip } from '@/actions/travel-schedule'
import { ScheduleTripRow } from './ScheduleTripRow'

const COLUMNS = ['EMBARQUE', 'VIAGEM / CLIENTE', 'DATAS / DESTINO', 'VOO DE IDA', 'VOO DE VOLTA', 'SERVIÇOS', 'TAREFAS', '']

export function ScheduleListView({
  orgSlug, filtered, today, onOpenTrip,
}: {
  orgSlug: string
  filtered: ScheduledTrip[]
  today: Date
  onOpenTrip: (t: ScheduledTrip) => void
}) {
  if (filtered.length === 0) {
    return <div className="p-8 text-center text-sm text-muted-foreground rounded-lg border bg-card">Nenhuma viagem com esse filtro.</div>
  }

  return (
    <div className="space-y-2">
      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b bg-muted/40">
              {COLUMNS.map(col => (
                <th key={col} className="py-2 px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap first:pl-4 last:pr-4">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(t => (
              <ScheduleTripRow key={t.id} orgSlug={orgSlug} t={t} today={today} onOpenTrip={onOpenTrip} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">{filtered.length} viagem{filtered.length !== 1 ? 's' : ''} encontrada{filtered.length !== 1 ? 's' : ''}</p>
    </div>
  )
}
