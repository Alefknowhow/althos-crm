'use client'

/**
 * Lista de Embarques — uma linha por viagem, layout definitivo da issue #9:
 * Embarque → Cliente/destino → Período → Voo de ida → Voo de volta →
 * Serviços → Pendências → Ações. Sem faixas de agrupamento por dia — data e
 * contador ficam em cada linha. Prop-driven, split out of ScheduleClient.tsx.
 */

import { Button } from '@/components/ui/button'
import type { ScheduledTrip } from '@/actions/travel-schedule'
import { ScheduleTripRow } from './ScheduleTripRow'

const COLUMNS = [
  'EMBARQUE', 'CLIENTE / DESTINO', 'PERÍODO', 'VOO DE IDA', 'VOO DE VOLTA', 'SERVIÇOS', 'PENDÊNCIAS', '',
]
const PAGE_SIZE = 25

export function ScheduleListView({
  orgSlug, filtered, today, onOpenTrip, page, setPage,
}: {
  orgSlug: string
  filtered: ScheduledTrip[]
  today: Date
  onOpenTrip: (t: ScheduledTrip, tab?: 'tarefas') => void
  page: number
  setPage: (fn: (p: number) => number) => void
}) {
  if (filtered.length === 0) {
    return <div className="p-8 text-center text-sm text-muted-foreground rounded-lg border bg-card">Nenhuma viagem com esse filtro.</div>
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

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
            {pageItems.map(t => (
              <ScheduleTripRow key={t.id} orgSlug={orgSlug} t={t} today={today} onOpenTrip={onOpenTrip} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{filtered.length} viagem{filtered.length !== 1 ? 's' : ''} encontrada{filtered.length !== 1 ? 's' : ''}</p>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={currentPage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
              Anterior
            </Button>
            <span className="text-xs text-muted-foreground whitespace-nowrap">Página {currentPage} de {totalPages}</span>
            <Button size="sm" variant="outline" disabled={currentPage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
              Próxima
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
