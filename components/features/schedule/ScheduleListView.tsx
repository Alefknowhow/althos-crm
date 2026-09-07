'use client'

/**
 * List view for ScheduleClient. Prop-driven, split out of
 * ScheduleClient.tsx.
 */

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { cn, formatCurrency } from '@/lib/utils'
import {
  MapPin, Plane, Hotel, MessageCircle, CalendarDays, Ticket, ArrowUpRight, UserRound,
} from 'lucide-react'
import type { ScheduledTrip } from '@/actions/travel-schedule'
import { STATE_META, type TripState } from './ScheduleGanttView'
import { stateLabel, whatsappLink } from './ScheduleTripDetail'

const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

const HEALTH_META: Record<string, { dot: string; title: string }> = {
  green: { dot: 'bg-emerald-500', title: 'Saúde da reserva: em dia — todas as tarefas concluídas' },
  yellow: { dot: 'bg-amber-500', title: 'Saúde da reserva: atenção — tarefa(s) pendente(s)' },
  red: { dot: 'bg-red-500', title: 'Saúde da reserva: pendência importante — tarefa de alta prioridade em aberto' },
}

const FLIGHT_STATUS_META: Record<string, { label: string; badge: string }> = {
  scheduled: { label: 'Previsto', badge: 'border-muted-foreground/30 text-muted-foreground' },
  active: { label: 'Em curso', badge: 'border-blue-300 text-blue-600 dark:border-blue-800 dark:text-blue-400' },
  landed: { label: 'Pousado', badge: 'border-emerald-300 text-emerald-600 dark:border-emerald-800 dark:text-emerald-400' },
  cancelled: { label: 'Cancelado', badge: 'border-red-300 text-red-600 dark:border-red-800 dark:text-red-400' },
  diverted: { label: 'Desviado', badge: 'border-orange-300 text-orange-600 dark:border-orange-800 dark:text-orange-400' },
  unknown: { label: 'Sem dados', badge: 'border-muted-foreground/30 text-muted-foreground' },
}

// Cor do ícone de calendário — carrega o sinal que antes era a bolinha
// roxa removida (já tínhamos a etiqueta de contagem, era redundante).
const DATE_ICON_COLOR: Record<'cancelled' | TripState, string> = {
  cancelled: 'text-red-500',
  upcoming: 'text-indigo-500',
  ongoing: 'text-emerald-600',
  past: 'text-slate-400',
}

function fmtTime(iso?: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function parseDate(s?: string | null): Date | null {
  if (!s) return null
  const d = new Date(s + 'T12:00:00')
  return isNaN(d.getTime()) ? null : d
}
function fmtDate(s?: string | null) {
  const d = parseDate(s)
  return d ? d.toLocaleDateString('pt-BR') : '—'
}

/** Rótulo/cor da etiqueta principal — sobrepõe o rótulo de data (upcoming/
 *  ongoing/past) com o status real da venda (cancelada) ou uma redação mais
 *  natural para viagem em curso/já realizada. */
function rowStatus(t: ScheduledTrip, state: TripState, dep: Date | null, today: Date) {
  if (t.status === 'cancelled') {
    return { key: 'cancelled' as const, label: 'Cancelada', badge: 'border-red-300 text-red-700 bg-red-50 dark:border-red-900 dark:text-red-400 dark:bg-red-950/30' }
  }
  if (state === 'ongoing') return { key: state, label: 'Em viagem', badge: STATE_META.ongoing.badge }
  if (state === 'past') return { key: state, label: 'Já realizada', badge: STATE_META.past.badge }
  return { key: state, label: stateLabel(state, dep, today), badge: STATE_META.upcoming.badge }
}

export function ScheduleListView({
  orgSlug, filtered, today, tripState, members, onOpenTrip,
}: {
  orgSlug: string
  filtered: ScheduledTrip[]
  today: Date
  tripState: (t: ScheduledTrip, today: Date) => TripState
  members: { user_id: string; name: string }[]
  onOpenTrip: (t: ScheduledTrip) => void
}) {
  return (
    <div className="rounded-none border bg-card divide-y">
      {filtered.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma viagem com esse filtro.</div>
      ) : filtered.map(t => {
        const state = tripState(t, today)
        const dep = parseDate(t.departure_date)
        const wa = whatsappLink(t.lead_phone)
        const locator = t.package_locator || t.air_locator
        const seller = members.find(m => m.user_id === t.created_by)?.name
        const status = rowStatus(t, state, dep, today)

        return (
          <div key={t.id} className="p-3 hover:bg-muted/40 transition-colors space-y-1.5">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onOpenTrip(t)}
                className="flex items-center gap-3 flex-1 min-w-0 text-left"
              >
                <div className="flex flex-col items-center justify-center w-11 h-11 shrink-0 rounded-lg bg-primary/10 text-primary">
                  <span className="text-[10px] leading-none uppercase font-medium">
                    {dep ? MONTHS_PT[dep.getMonth()] : ''}
                  </span>
                  <span className="text-sm leading-tight font-semibold">
                    {dep ? dep.getDate() : '—'}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn('w-3 h-3 rounded-full shrink-0', HEALTH_META[t.health]?.dot)}
                      title={HEALTH_META[t.health]?.title}
                    />
                    <span className="font-medium truncate">{t.client_name || t.lead_name || 'Viagem'}</span>
                    <Badge variant="outline" className={cn('shrink-0 text-[10px]', status.badge)}>{status.label}</Badge>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-muted-foreground">
                    {t.destination && (
                      <span className="inline-flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 shrink-0" /> <span className="truncate">{t.destination}</span>
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 shrink-0">
                      <CalendarDays className={cn('w-3 h-3 shrink-0', DATE_ICON_COLOR[status.key])} />
                      {fmtDate(t.departure_date)} – {fmtDate(t.return_date)}
                    </span>
                    {seller && (
                      <span className="inline-flex items-center gap-1 truncate max-w-[140px]">
                        <UserRound className="w-3 h-3 shrink-0" /> <span className="truncate">{seller}</span>
                      </span>
                    )}
                    {t.hotel_name && (
                      <span className="inline-flex items-center gap-1 truncate max-w-[180px]">
                        <Hotel className="w-3 h-3 shrink-0" /> {t.hotel_name}
                      </span>
                    )}
                    {(t.airline || t.operator) && (
                      <span className="inline-flex items-center gap-1 truncate max-w-[180px]">
                        <Plane className="w-3 h-3 shrink-0" /> {t.airline || t.operator}
                      </span>
                    )}
                    {locator && (
                      <span className="inline-flex items-center gap-1 shrink-0">
                        <Ticket className="w-3 h-3" /> {locator}
                      </span>
                    )}
                    <span className="font-medium text-foreground/80 shrink-0">
                      {formatCurrency(t.total_cents || 0)}
                    </span>
                  </div>
                  {t.flights.length > 0 && (
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                      {t.flights.map((f, i) => {
                        const meta = FLIGHT_STATUS_META[f.status || 'scheduled']
                        return (
                          <span key={i} className="inline-flex items-center gap-1 shrink-0">
                            <Plane className="w-3 h-3 shrink-0" />
                            <span className="font-medium text-foreground/70">{f.sentido === 'volta' ? 'Volta' : 'Ida'}</span>
                            {f.numero_voo && <span>{f.numero_voo}</span>}
                            {(f.origem || f.destino) && <span>{f.origem}→{f.destino}</span>}
                            {f.horario && <span>{f.horario}</span>}
                            <Badge
                              variant="outline"
                              className={cn('text-[9px] px-1 py-0', meta?.badge)}
                              title={f.revised_departure ? `Novo horário: ${fmtTime(f.revised_departure)}` : undefined}
                            >
                              {meta?.label}{f.delay_minutes ? ` +${f.delay_minutes}min` : ''}
                            </Badge>
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
              </button>
              <div className="flex items-center gap-1.5 shrink-0">
                {wa && (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center w-7 h-7 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                    aria-label="Abrir WhatsApp"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </a>
                )}
                <Link
                  href={`/app/${orgSlug}/reservas?sale=${t.id}`}
                  className="inline-flex items-center justify-center w-7 h-7 rounded-md text-primary hover:bg-primary/10 transition-colors"
                  aria-label="Abrir reserva"
                  title="Abrir reserva"
                >
                  <ArrowUpRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
