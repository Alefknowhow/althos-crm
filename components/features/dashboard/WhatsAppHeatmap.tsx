'use client'

import { useMemo, useState } from 'react'
import type { WhatsappHeatmapCell } from '@/actions/whatsapp-analytics'

const DOW_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
// Segunda a domingo na tela (mais natural pra leitura de semana de trabalho);
// os dados usam getDay() (0=domingo), então mapeamos a ordem de exibição aqui.
const DOW_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

type Filter = 'all' | 'inbound' | 'outbound'
const FILTER_LABELS: Record<Filter, string> = { all: 'Tudo', inbound: 'Recebidas', outbound: 'Enviadas' }

/** Escala de intensidade Carbon (azul) — mesma família do resto do
 *  dashboard (ver lib/charts/carbon-theme.ts), sem depender de recharts:
 *  é só uma grade 24x7 de células coloridas. */
function intensityColor(ratio: number): string {
  if (ratio <= 0) return 'hsl(var(--muted) / 0.4)'
  const steps = [
    { max: 0.15, color: '#d0e2ff' },
    { max: 0.35, color: '#a6c8ff' },
    { max: 0.55, color: '#78a9ff' },
    { max: 0.75, color: '#4589ff' },
    { max: 0.9, color: '#0f62fe' },
    { max: 1.01, color: '#0043ce' },
  ]
  const step = steps.find(s => ratio <= s.max) || steps[steps.length - 1]
  return step.color
}

export default function WhatsAppHeatmap({ cells }: { cells: WhatsappHeatmapCell[] }) {
  const [filter, setFilter] = useState<Filter>('all')

  const countOf = (c: WhatsappHeatmapCell) =>
    filter === 'inbound' ? c.inbound : filter === 'outbound' ? c.outbound : c.inbound + c.outbound

  const maxCount = useMemo(() => Math.max(1, ...cells.map(countOf)), [cells, filter])
  const byKey = useMemo(() => new Map(cells.map(c => [`${c.dow}-${c.hour}`, countOf(c)])), [cells, filter])
  const hasData = cells.some(c => countOf(c) > 0)

  return (
    <div className="w-full space-y-2">
      <div className="flex justify-end">
        <select
          className="h-8 rounded-md border border-input bg-input/25 px-2 text-xs"
          value={filter}
          onChange={e => setFilter(e.target.value as Filter)}
          aria-label="Filtrar heatmap"
        >
          {(Object.keys(FILTER_LABELS) as Filter[]).map(f => (
            <option key={f} value={f}>{FILTER_LABELS[f]}</option>
          ))}
        </select>
      </div>

      <div className="w-full overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="flex">
            <div className="w-10 shrink-0" />
            <div className="flex-1 grid gap-[2px]" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
              {Array.from({ length: 24 }).map((_, h) => (
                <div key={h} className="text-center text-[9px] text-muted-foreground">
                  {h % 3 === 0 ? h : ''}
                </div>
              ))}
            </div>
          </div>
          {DOW_DISPLAY_ORDER.map(dow => (
            <div key={dow} className="flex items-center mt-[2px]">
              <div className="w-10 shrink-0 text-[10px] text-muted-foreground">{DOW_LABELS[dow]}</div>
              <div className="flex-1 grid gap-[2px]" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
                {Array.from({ length: 24 }).map((_, hour) => {
                  const count = byKey.get(`${dow}-${hour}`) || 0
                  const ratio = count / maxCount
                  return (
                    <div
                      key={hour}
                      title={`${DOW_LABELS[dow]} ${hour}h — ${count} mensagem${count === 1 ? '' : 's'} (${FILTER_LABELS[filter].toLowerCase()})`}
                      className="aspect-square rounded-[2px]"
                      style={{ backgroundColor: intensityColor(ratio) }}
                    />
                  )
                })}
              </div>
            </div>
          ))}
          {!hasData && (
            <p className="text-xs text-muted-foreground mt-2">Sem mensagens no período selecionado.</p>
          )}
        </div>
      </div>
    </div>
  )
}
