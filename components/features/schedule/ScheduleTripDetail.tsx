'use client'

/**
 * Trip detail dialog content for ScheduleClient. Prop-driven, split out
 * of ScheduleClient.tsx.
 */

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn, formatCurrency } from '@/lib/utils'
import {
  MapPin, Plane, Hotel, MessageCircle, ExternalLink, CheckSquare, Loader2,
  CalendarDays, Ticket, Building2, UserRound,
} from 'lucide-react'
import type { ScheduledTrip, TripTask } from '@/actions/travel-schedule'
import { STATE_META, type TripState } from './ScheduleGanttView'

function parseDate(s?: string | null): Date | null {
  if (!s) return null
  const d = new Date(s + 'T12:00:00')
  return isNaN(d.getTime()) ? null : d
}
function fmtDate(s?: string | null) {
  const d = parseDate(s)
  return d ? d.toLocaleDateString('pt-BR') : '—'
}
function fmtTime(iso?: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
const DAY = 86400000

export const HEALTH_META: Record<string, { dot: string; title: string }> = {
  green: { dot: 'bg-emerald-500', title: 'Saúde da reserva: em dia — todas as tarefas concluídas' },
  yellow: { dot: 'bg-amber-500', title: 'Saúde da reserva: atenção — tarefa(s) pendente(s)' },
  red: { dot: 'bg-red-500', title: 'Saúde da reserva: pendência importante — tarefa de alta prioridade em aberto' },
}

export const FLIGHT_STATUS_META: Record<string, { label: string; badge: string }> = {
  scheduled: { label: 'Previsto', badge: 'border-muted-foreground/30 text-muted-foreground' },
  active: { label: 'Em curso', badge: 'border-blue-300 text-blue-600 dark:border-blue-800 dark:text-blue-400' },
  landed: { label: 'Pousado', badge: 'border-emerald-300 text-emerald-600 dark:border-emerald-800 dark:text-emerald-400' },
  cancelled: { label: 'Cancelado', badge: 'border-red-300 text-red-600 dark:border-red-800 dark:text-red-400' },
  diverted: { label: 'Desviado', badge: 'border-orange-300 text-orange-600 dark:border-orange-800 dark:text-orange-400' },
  unknown: { label: 'Sem dados', badge: 'border-muted-foreground/30 text-muted-foreground' },
}

/** Cor do ícone de calendário/indicador de status — usada tanto na lista
 *  quanto no popup de detalhe. */
export const DATE_ICON_COLOR: Record<'cancelled' | TripState, string> = {
  cancelled: 'text-red-500',
  upcoming: 'text-indigo-500',
  ongoing: 'text-emerald-600',
  past: 'text-slate-400',
}

/** Rótulo/cor da etiqueta principal — sobrepõe o rótulo de data (upcoming/
 *  ongoing/past) com o status real da venda (cancelada) ou uma redação mais
 *  natural para viagem em curso/já realizada. Compartilhado entre a lista e
 *  o popup de detalhe. */
export function rowStatus(t: ScheduledTrip, state: TripState, dep: Date | null, today: Date) {
  if (t.status === 'cancelled') {
    return { key: 'cancelled' as const, label: 'Cancelada', badge: 'border-red-300 text-red-700 bg-red-50 dark:border-red-900 dark:text-red-400 dark:bg-red-950/30' }
  }
  if (state === 'ongoing') return { key: state, label: 'Em viagem', badge: STATE_META.ongoing.badge }
  if (state === 'past') return { key: state, label: 'Já realizada', badge: STATE_META.past.badge }
  return { key: state, label: stateLabel(state, dep, today), badge: STATE_META.upcoming.badge }
}

/** Rótulo da etiqueta de estado — para "Próxima" mostra a contagem
 *  regressiva ("Faltam N dias") em vez do texto fixo, mais útil pra
 *  priorizar o que precisa de atenção primeiro. */
export function stateLabel(state: TripState, dep: Date | null, today: Date): string {
  if (state !== 'upcoming' || !dep) return STATE_META[state].label
  const days = Math.round((dep.getTime() - today.getTime()) / DAY)
  if (days <= 0) return 'Embarca hoje'
  if (days === 1) return 'Falta 1 dia'
  return `Faltam ${days} dias`
}

export function whatsappLink(phone?: string | null): string | null {
  if (!phone) return null
  let digits = phone.replace(/\D/g, '')
  if (!digits) return null
  if (digits.length === 10 || digits.length === 11) digits = '55' + digits
  return `https://wa.me/${digits}`
}

export function TripDetail({
  orgSlug, trip, tasks, loadingTasks, state, today, sellerName,
}: {
  orgSlug: string
  trip: ScheduledTrip
  tasks: TripTask[]
  loadingTasks: boolean
  state: TripState
  today: Date
  sellerName?: string
}) {
  const wa = whatsappLink(trip.lead_phone)
  const dep = parseDate(trip.departure_date)
  const status = rowStatus(trip, state, dep, today)
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 pr-6">
          <span
            className={cn('w-3 h-3 rounded-full shrink-0', HEALTH_META[trip.health]?.dot)}
            title={HEALTH_META[trip.health]?.title}
          />
          <span className="truncate">{trip.client_name || trip.lead_name || 'Viagem'}</span>
          <Badge variant="outline" className={cn('shrink-0 text-[10px]', status.badge)}>{status.label}</Badge>
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        {/* período */}
        <div className="rounded-lg border bg-muted/30 p-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <CalendarDays className={cn('w-4 h-4 shrink-0', DATE_ICON_COLOR[status.key])} />
            <span className="font-medium">{fmtDate(trip.departure_date)}</span>
            <span className="text-muted-foreground">→</span>
            <span className="font-medium">{fmtDate(trip.return_date)}</span>
          </div>
          <span className="text-sm font-semibold tabular-nums shrink-0">{formatCurrency(trip.total_cents || 0)}</span>
        </div>

        {/* infos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {sellerName && <Info icon={UserRound} label="Agente de viagem" value={sellerName} />}
          {trip.destination && <Info icon={MapPin} label="Destino" value={trip.destination} />}
          {trip.hotel_name && <Info icon={Hotel} label="Hospedagem" value={trip.hotel_name} />}
          {trip.airline && <Info icon={Plane} label="Cia aérea" value={trip.airline} />}
          {trip.operator && <Info icon={Building2} label="Operadora" value={trip.operator} />}
          {trip.package_locator && <Info icon={Ticket} label="Localizador pacote" value={trip.package_locator} />}
          {trip.air_locator && <Info icon={Ticket} label="Localizador aéreo" value={trip.air_locator} />}
        </div>

        {/* voos */}
        {trip.flights.length > 0 && (
          <div>
            <div className="flex items-center gap-2 text-sm font-medium mb-2">
              <Plane className="w-4 h-4 text-primary" /> Voos
            </div>
            <div className="space-y-1.5">
              {trip.flights.map((f, i) => {
                const fmeta = FLIGHT_STATUS_META[f.status || 'scheduled']
                return (
                  <div key={i} className="flex items-center justify-between gap-2 rounded-lg border p-2.5 text-sm flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="font-medium text-foreground/80">{f.sentido === 'volta' ? 'Volta' : 'Ida'}</span>
                      {f.numero_voo && <span className="text-muted-foreground">{f.numero_voo}</span>}
                      {(f.origem || f.destino) && <span className="text-muted-foreground">{f.origem}→{f.destino}</span>}
                      {f.horario && <span className="text-muted-foreground">{f.horario}</span>}
                      {f.data && <span className="text-muted-foreground">{fmtDate(f.data)}</span>}
                    </div>
                    <Badge
                      variant="outline"
                      className={cn('text-[10px] shrink-0', fmeta?.badge)}
                      title={f.revised_departure ? `Novo horário: ${fmtTime(f.revised_departure)}` : undefined}
                    >
                      {fmeta?.label}{f.delay_minutes ? ` +${f.delay_minutes}min` : ''}
                    </Badge>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ações */}
        <div className="flex flex-wrap gap-2">
          {wa ? (
            <Button size="sm" asChild className="bg-emerald-600 hover:bg-emerald-700">
              <a href={wa} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="w-4 h-4 mr-1.5" /> WhatsApp do cliente
              </a>
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled title="Lead sem telefone cadastrado">
              <MessageCircle className="w-4 h-4 mr-1.5" /> Sem telefone
            </Button>
          )}
          {trip.airline_checkin_url && (
            <Button size="sm" variant="outline" asChild>
              <a href={trip.airline_checkin_url} target="_blank" rel="noopener noreferrer">
                <Plane className="w-4 h-4 mr-1.5" /> Check-in
              </a>
            </Button>
          )}
          <Button size="sm" variant="outline" asChild>
            <Link href={`/app/${orgSlug}/reservas?sale=${trip.id}`}>
              <ExternalLink className="w-4 h-4 mr-1.5" /> Abrir reserva
            </Link>
          </Button>
        </div>

        {/* tarefas */}
        <div>
          <div className="flex items-center gap-2 text-sm font-medium mb-2">
            <CheckSquare className="w-4 h-4 text-primary" /> Tarefas relacionadas
            {loadingTasks && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
          </div>
          {!trip.contato_id ? (
            <p className="text-sm text-muted-foreground">Viagem sem lead vinculado — sem tarefas.</p>
          ) : !loadingTasks && tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma tarefa para este cliente.</p>
          ) : (
            <ul className="space-y-1.5">
              {tasks.map(t => {
                const done = t.status === 'done' || t.status === 'completed'
                return (
                  <li key={t.id} className="flex items-start gap-2 rounded-lg border p-2.5 text-sm">
                    <CheckSquare className={cn('w-4 h-4 mt-0.5 shrink-0', done ? 'text-emerald-600' : 'text-muted-foreground')} />
                    <div className="min-w-0 flex-1">
                      <p className={cn('truncate', done && 'line-through text-muted-foreground')}>{t.title || 'Tarefa'}</p>
                      {t.due_date && (
                        <p className="text-xs text-muted-foreground">{new Date(t.due_date).toLocaleDateString('pt-BR')}</p>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          <Button size="sm" variant="ghost" className="mt-2" asChild>
            <Link href={`/app/${orgSlug}/tarefas`}>Ver todas as tarefas</Link>
          </Button>
        </div>
      </div>
    </>
  )
}

function Info({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="font-medium break-words">{value}</p>
      </div>
    </div>
  )
}
