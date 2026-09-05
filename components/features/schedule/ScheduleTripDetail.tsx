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
const DAY = 86400000

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
  const meta = STATE_META[state]
  const wa = whatsappLink(trip.lead_phone)
  const dep = parseDate(trip.departure_date)
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 pr-6">
          <span className="truncate">{trip.client_name || trip.lead_name || 'Viagem'}</span>
          <Badge variant="outline" className={cn('shrink-0 text-[10px]', meta.badge)}>{stateLabel(state, dep, today)}</Badge>
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        {/* período */}
        <div className="rounded-lg border bg-muted/30 p-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
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
