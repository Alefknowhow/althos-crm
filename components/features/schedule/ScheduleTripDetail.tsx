'use client'

/**
 * Painel lateral (Sheet) de detalhe da viagem/reserva — aberto a partir da
 * lista ou do Gantt de Gestão de Viagens. Substitui o antigo Dialog central
 * por um painel deslizante (~40% da largura), com os dados principais da
 * reserva no topo e o restante organizado em abas (Tarefas/Produtos/
 * Viajantes/Vouchers) pra caber tudo sem virar uma parede de texto.
 */

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { cn, formatCurrency } from '@/lib/utils'
import {
  Plane, MessageCircle, ExternalLink, CalendarDays, Ticket, Building2, UserRound, AlertTriangle,
} from 'lucide-react'
import type { ScheduledTrip, TripTask, TripTraveler, TripVoucher } from '@/actions/travel-schedule'
import type { SaleProduct } from '@/actions/sale-products'
import { STATE_META, type TripState } from './ScheduleGanttView'
import { ScheduleTripDetailTabs } from './ScheduleTripDetailTabs'

function parseDate(s?: string | null): Date | null {
  if (!s) return null
  const d = new Date(s + 'T12:00:00')
  return isNaN(d.getTime()) ? null : d
}
export function fmtDate(s?: string | null) {
  const d = parseDate(s)
  return d ? d.toLocaleDateString('pt-BR') : '—'
}
const DAY = 86400000

export const HEALTH_META: Record<string, { dot: string; title: string }> = {
  green: { dot: 'bg-emerald-500', title: 'Saúde da reserva: em dia — todas as tarefas concluídas' },
  yellow: { dot: 'bg-amber-500', title: 'Saúde da reserva: atenção — tarefa(s) pendente(s)' },
  red: { dot: 'bg-red-500', title: 'Saúde da reserva: pendência importante — tarefa de alta prioridade em aberto' },
}

export const FLIGHT_STATUS_META: Record<string, { label: string; badge: string }> = {
  scheduled: { label: 'Previsto', badge: 'bg-muted-foreground/60 text-white border-transparent' },
  active: { label: 'Em curso', badge: 'bg-info text-info-foreground border-transparent' },
  landed: { label: 'Pousado', badge: 'bg-success text-success-foreground border-transparent' },
  cancelled: { label: 'Cancelado', badge: 'bg-destructive text-destructive-foreground border-transparent' },
  diverted: { label: 'Desviado', badge: 'bg-warning text-warning-foreground border-transparent' },
  unknown: { label: 'Sem dados', badge: 'bg-muted-foreground/60 text-white border-transparent' },
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
 *  o painel de detalhe. */
export function rowStatus(t: ScheduledTrip, state: TripState, dep: Date | null, today: Date) {
  if (t.status === 'cancelled') {
    return { key: 'cancelled' as const, label: 'Cancelada', badge: 'bg-destructive text-destructive-foreground border-transparent' }
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

/** Etiquetas de alerta no topo do painel — voo cancelado/desviado/atrasado,
 *  reserva cancelada ou tarefa crítica pendente. Só aparece o que se aplica. */
function AlertBadges({ trip }: { trip: ScheduledTrip }) {
  const badges: { key: string; label: string; cls: string }[] = []
  if (trip.status === 'cancelled') {
    badges.push({ key: 'cancelled', label: 'Reserva cancelada', cls: 'bg-destructive text-destructive-foreground border-transparent' })
  }
  if (trip.flights.some(f => f.status === 'cancelled')) {
    badges.push({ key: 'flight_cancelled', label: 'Voo cancelado', cls: 'bg-destructive text-destructive-foreground border-transparent' })
  }
  if (trip.flights.some(f => f.status === 'diverted')) {
    badges.push({ key: 'flight_diverted', label: 'Voo desviado', cls: 'bg-warning text-warning-foreground border-transparent' })
  }
  const maxDelay = Math.max(0, ...trip.flights.map(f => f.delay_minutes || 0))
  if (maxDelay > 0) {
    badges.push({ key: 'delay', label: `Voo atrasado +${Math.floor(maxDelay / 60)}h${maxDelay % 60 || ''}`, cls: 'bg-warning text-warning-foreground border-transparent' })
  }
  if (trip.status !== 'cancelled' && trip.health === 'red') {
    badges.push({ key: 'health', label: 'Tarefa pendente crítica', cls: 'bg-destructive/15 text-destructive border-destructive/30' })
  }
  if (badges.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map(b => (
        <Badge key={b.key} variant="outline" className={cn('text-[10px] gap-1', b.cls)}>
          <AlertTriangle className="w-3 h-3" /> {b.label}
        </Badge>
      ))}
    </div>
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

export function TripDetail({
  orgSlug, trip, tasks, loadingTasks, products, loadingProducts, travelers, vouchers, loadingExtra,
  state, today, sellerName, open, onOpenChange,
}: {
  orgSlug: string
  trip: ScheduledTrip | null
  tasks: TripTask[]
  loadingTasks: boolean
  products: SaleProduct[]
  loadingProducts: boolean
  travelers: TripTraveler[]
  vouchers: TripVoucher[]
  loadingExtra: boolean
  state: TripState
  today: Date
  sellerName?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-none sm:w-[40vw] sm:min-w-[440px] p-0 flex flex-col gap-0"
      >
        {trip && (
          <TripDetailBody
            orgSlug={orgSlug}
            trip={trip}
            tasks={tasks}
            loadingTasks={loadingTasks}
            products={products}
            loadingProducts={loadingProducts}
            travelers={travelers}
            vouchers={vouchers}
            loadingExtra={loadingExtra}
            state={state}
            today={today}
            sellerName={sellerName}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function TripDetailBody({
  orgSlug, trip, tasks, loadingTasks, products, loadingProducts, travelers, vouchers, loadingExtra,
  state, today, sellerName,
}: {
  orgSlug: string
  trip: ScheduledTrip
  tasks: TripTask[]
  loadingTasks: boolean
  products: SaleProduct[]
  loadingProducts: boolean
  travelers: TripTraveler[]
  vouchers: TripVoucher[]
  loadingExtra: boolean
  state: TripState
  today: Date
  sellerName?: string
}) {
  const wa = whatsappLink(trip.lead_phone)
  const dep = parseDate(trip.departure_date)
  const status = rowStatus(trip, state, dep, today)

  return (
    <>
      {/* ── topo: dados principais da reserva ─────────────────────── */}
      <SheetHeader className="p-5 pb-4 border-b shrink-0 space-y-3 text-left">
        <SheetTitle className="flex items-center gap-2 pr-6">
          <span
            className={cn('w-3 h-3 rounded-full shrink-0', HEALTH_META[trip.health]?.dot)}
            title={HEALTH_META[trip.health]?.title}
          />
          <span className="truncate">{trip.client_name || trip.lead_name || 'Viagem'}</span>
          <Badge variant="outline" className={cn('shrink-0 text-[10px]', status.badge)}>{status.label}</Badge>
        </SheetTitle>

        <AlertBadges trip={trip} />

        <div className="rounded-lg border bg-muted/30 p-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <CalendarDays className={cn('w-4 h-4 shrink-0', DATE_ICON_COLOR[status.key])} />
            <span className="font-medium">{fmtDate(trip.departure_date)}</span>
            <span className="text-muted-foreground">→</span>
            <span className="font-medium">{fmtDate(trip.return_date)}</span>
            {trip.destination && (
              <>
                <span className="text-muted-foreground">·</span>
                {trip.destination_flag && <span>{trip.destination_flag}</span>}
                <span className="font-medium">{trip.destination}</span>
              </>
            )}
          </div>
          <span className="text-sm font-semibold tabular-nums shrink-0">{formatCurrency(trip.total_cents || 0)}</span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          {sellerName && <Info icon={UserRound} label="Vendedor" value={sellerName} />}
          {trip.operator && <Info icon={Building2} label="Operadora" value={trip.operator} />}
          {trip.package_locator && <Info icon={Ticket} label="Localizador pacote" value={trip.package_locator} />}
          {trip.air_locator && <Info icon={Ticket} label="Localizador aéreo" value={trip.air_locator} />}
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {wa ? (
            <Button size="sm" asChild className="bg-emerald-600 hover:bg-emerald-700">
              <a href={wa} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="w-4 h-4 mr-1.5" /> WhatsApp
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
      </SheetHeader>

      {/* ── abas (Tarefas/Produtos/Viajantes/Vouchers) — ver ScheduleTripDetailTabs ── */}
      <ScheduleTripDetailTabs
        orgSlug={orgSlug}
        trip={trip}
        tasks={tasks}
        loadingTasks={loadingTasks}
        products={products}
        loadingProducts={loadingProducts}
        travelers={travelers}
        vouchers={vouchers}
        loadingExtra={loadingExtra}
      />
    </>
  )
}
