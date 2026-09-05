'use client'

/**
 * Gantt (timeline) view for ScheduleClient. Prop-driven, split out of
 * ScheduleClient.tsx.
 */

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ScheduledTrip } from '@/actions/travel-schedule'

const DAY_PX = 22

export type TripState = 'upcoming' | 'ongoing' | 'past'

export const STATE_META: Record<TripState, { label: string; bar: string; dot: string; badge: string; row: string }> = {
  upcoming: { label: 'Próxima', bar: 'bg-indigo-500', dot: 'bg-indigo-500', badge: 'bg-indigo-100 text-indigo-700 border-indigo-200', row: 'bg-indigo-500/[0.06]' },
  ongoing: { label: 'Em andamento', bar: 'bg-emerald-500', dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', row: 'bg-emerald-500/[0.06]' },
  past: { label: 'Concluída', bar: 'bg-slate-400', dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600 border-slate-200', row: 'bg-slate-400/[0.06]' },
}

export function ScheduleGanttView({
  ganttRef, months, dayNumbers, dayLines, todayPct, dayWidthPct, totalDays, ganttTrips,
  dayOffset, setDayOffset, navStepDays, onOpenTrip,
}: {
  ganttRef: React.RefObject<HTMLDivElement>
  months: { label: string; leftPct: number; widthPct: number }[]
  dayNumbers: { day: number; leftPct: number }[]
  dayLines: number[]
  todayPct: number | null
  dayWidthPct: number
  totalDays: number
  ganttTrips: { trip: ScheduledTrip; left: number; width: number; state: TripState }[]
  dayOffset: number
  setDayOffset: (fn: (o: number) => number) => void
  navStepDays: number
  onOpenTrip: (t: ScheduledTrip) => void
}) {
  return (
    <>
      <div ref={ganttRef} className="rounded-none border bg-card overflow-hidden">
        {/* nav header */}
        <div className="flex items-center justify-between gap-2 p-3 border-b">
          <Button variant="outline" size="sm" onClick={() => setDayOffset(o => o - navStepDays)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium">
            {months[0]?.label} — {months[months.length - 1]?.label}
          </span>
          <div className="flex items-center gap-2">
            {dayOffset !== 0 && (
              <Button variant="ghost" size="sm" onClick={() => setDayOffset(() => 0)}>Hoje</Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setDayOffset(o => o + navStepDays)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* colunas ganham uma largura mínima em px — se isso passar da
            largura do painel, a área inteira (cabeçalhos + linhas) rola
            horizontalmente junto, em vez de espremer os dias. */}
        <div className="overflow-x-auto">
          <div style={{ width: `max(100%, ${totalDays * DAY_PX}px)` }}>
            {/* month columns header */}
            <div className="relative h-7 border-b bg-muted/30">
              {months.map((m, i) => (
                <div key={i}
                  className="absolute top-0 h-full flex items-center justify-center text-[11px] font-medium text-muted-foreground border-l first:border-l-0"
                  style={{ left: `${m.leftPct}%`, width: `${m.widthPct}%` }}>
                  {m.label}
                </div>
              ))}
            </div>

            {/* dia do mês — linha bem discreta, fundo diferenciado pra
                separar visualmente do resto da grade */}
            <div className="relative h-4 border-b bg-muted/60">
              {dayNumbers.map((d, i) => (
                <div key={i}
                  className="absolute top-0 h-full flex items-center justify-center text-[8px] leading-none text-muted-foreground/70"
                  style={{ left: `${d.leftPct}%`, width: `${dayWidthPct}%` }}>
                  {d.day}
                </div>
              ))}
            </div>

            {/* rows — altura mínima padrão, preenche até o fim da tela;
                além disso rola verticalmente em vez de esticar a página.
                Linhas de grade horizontais a cada 48px (altura de uma linha
                de viagem) cobrem o espaço inteiro, não só onde há viagens. */}
            <div
              className="relative min-h-[360px] h-[calc(100vh-440px)] overflow-y-auto"
              style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0, transparent 47px, hsl(var(--border) / 0.5) 47px, hsl(var(--border) / 0.5) 48px)' }}
            >
              {/* linhas verticais marcando cada dia */}
              {dayLines.map((pct, i) => (
                <div key={i} className="absolute top-0 bottom-0 w-px bg-border/60 pointer-events-none" style={{ left: `${pct}%` }} />
              ))}
              {/* coluna do dia de hoje, pintada */}
              {todayPct !== null && (
                <div className="absolute top-0 bottom-0 bg-primary/10 border-x border-primary/30 z-10 pointer-events-none"
                  style={{ left: `${todayPct}%`, width: `${dayWidthPct}%` }}>
                  <span className="absolute -top-0 left-1/2 -translate-x-1/2 text-[9px] font-medium text-primary bg-card px-1 whitespace-nowrap">Hoje</span>
                </div>
              )}
              {ganttTrips.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Nenhuma viagem nesse período. Use as setas para navegar.
                </div>
              ) : ganttTrips.map(({ trip, left, width, state }) => {
                const meta = STATE_META[state]
                return (
                  <div key={trip.id} className={cn('relative h-12 border-b last:border-b-0', meta.row)}>
                    <button
                      type="button"
                      onClick={() => onOpenTrip(trip)}
                      title={`${trip.client_name || trip.lead_name || 'Viagem'} — ${trip.destination || ''}`}
                      className={cn(
                        'absolute top-1/2 -translate-y-1/2 h-10 rounded-md px-2 flex items-center text-[11px] font-medium text-white   hover:brightness-95 transition-all overflow-hidden',
                        meta.bar,
                      )}
                      style={{ left: `${left}%`, width: `${width}%`, minWidth: 60 }}
                    >
                      <span className="truncate">
                        {trip.client_name || trip.lead_name || 'Viagem'}
                        {trip.destination ? ` · ${trip.destination}` : ''}
                      </span>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* legenda */}
      <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-muted-foreground">
        {(['upcoming', 'ongoing', 'past'] as TripState[]).map(s => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={cn('w-3 h-3 rounded-sm', STATE_META[s].bar)} /> {STATE_META[s].label}
          </span>
        ))}
      </div>
    </>
  )
}

