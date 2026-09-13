'use client'

/**
 * Card de viagem do painel de Embarques — redesenhado guiado pelo anexo 2:
 * cabeçalho com badge de data + destino + status, "Ver viagem"/"...",
 * linha responsável/localizador/valor, mini-cards de itens inclusos
 * (hospedagem/transfer/passeios/...), barra "Ida → Volta" (anexo 3) e
 * itinerário com voos — agrupado por sentido, mostrando conexões quando a
 * reserva tem mais de um trecho na mesma direção. Extraído de
 * ScheduleListView.tsx.
 */

import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { cn, formatCurrency } from '@/lib/utils'
import {
  MapPin, Plane, Hotel, Car, Ship, ShieldCheck, Compass, Ticket, Package,
  MessageCircle, CalendarDays, ArrowUpRight, UserRound, MoreHorizontal,
  ChevronDown, ClipboardCopy, FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import type { ScheduledTrip, FlightLegInfo } from '@/actions/travel-schedule'
import { type TripState } from './ScheduleGanttView'
import {
  whatsappLink, rowStatus, HEALTH_META, FLIGHT_STATUS_META, DATE_ICON_COLOR,
} from './ScheduleTripDetail'
import { ScheduleTripTimelineBar } from './ScheduleTripTimelineBar'

const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

const INCLUDED_META: Record<string, { label: string; icon: typeof Plane }> = {
  voos: { label: 'Voos', icon: Plane },
  hospedagem: { label: 'Hospedagem', icon: Hotel },
  transfer: { label: 'Transfer', icon: Car },
  cruzeiros: { label: 'Cruzeiros', icon: Ship },
  seguro: { label: 'Seguro viagem', icon: ShieldCheck },
  passeios: { label: 'Passeios', icon: Compass },
  carros: { label: 'Locação de carro', icon: Car },
  ingressos: { label: 'Ingressos', icon: Ticket },
  servicos: { label: 'Serviços', icon: Package },
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

/** Duração entre o horário de um trecho e o do próximo — usada como
 *  "tempo de conexão" quando há mais de um voo no mesmo sentido. */
function connectionLabel(a: FlightLegInfo, b: FlightLegInfo): string | null {
  if (!a.data || !a.horario || !b.data || !b.horario) return null
  const ta = new Date(`${a.data}T${a.horario}`).getTime()
  const tb = new Date(`${b.data}T${b.horario}`).getTime()
  if (isNaN(ta) || isNaN(tb) || tb <= ta) return null
  const mins = Math.round((tb - ta) / 60000)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `Conexão em ${a.destino || '—'} · ${h > 0 ? `${h}h` : ''}${m > 0 ? `${m}min` : ''}`.trim()
}

function FlightLeg({ leg, showConnection }: { leg: FlightLegInfo; showConnection: string | null }) {
  const meta = FLIGHT_STATUS_META[leg.status || 'scheduled']
  return (
    <div className="space-y-1">
      {showConnection && (
        <p className="text-[10px] text-muted-foreground pl-4 italic">{showConnection}</p>
      )}
      <div className="rounded-md border bg-muted/20 p-2 text-xs space-y-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-foreground/80">{leg.numero_voo || leg.companhia || 'Voo'}</span>
          <Badge variant="outline" className={cn('text-[9px] px-1 py-0', meta?.badge)}
            title={leg.revised_departure ? `Novo horário: ${fmtTime(leg.revised_departure)}` : undefined}>
            {meta?.label}{leg.delay_minutes ? ` +${leg.delay_minutes}min` : ''}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span>{leg.origem || '—'} → {leg.destino || '—'}</span>
          {leg.horario && <span>· {leg.horario}</span>}
        </div>
      </div>
    </div>
  )
}

export function ScheduleTripCard({
  orgSlug, t, today, tripState, sellerName, onOpenTrip,
}: {
  orgSlug: string
  t: ScheduledTrip
  today: Date
  tripState: (t: ScheduledTrip, today: Date) => TripState
  sellerName?: string
  onOpenTrip: (t: ScheduledTrip) => void
}) {
  const [itineraryOpen, setItineraryOpen] = useState(true)
  const state = tripState(t, today)
  const dep = parseDate(t.departure_date)
  const ret = parseDate(t.return_date)
  const wa = whatsappLink(t.lead_phone)
  const locator = t.package_locator || t.air_locator
  const status = rowStatus(t, state, dep, today)

  const idaLegs = t.flights.filter(f => f.sentido !== 'volta')
  const voltaLegs = t.flights.filter(f => f.sentido === 'volta')

  function copyLocator() {
    if (!locator) return
    navigator.clipboard.writeText(locator).then(() => toast.success('Localizador copiado.'))
  }

  return (
    <div className="rounded-lg border bg-card p-3.5 space-y-3">
      {/* Cabeçalho */}
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center justify-center w-11 h-11 shrink-0 rounded-lg bg-primary/10 text-primary">
          <span className="text-[10px] leading-none uppercase font-medium">{dep ? MONTHS_PT[dep.getMonth()] : ''}</span>
          <span className="text-sm leading-tight font-semibold">{dep ? dep.getDate() : '—'}</span>
        </div>

        <button type="button" onClick={() => onOpenTrip(t)} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', HEALTH_META[t.health]?.dot)} title={HEALTH_META[t.health]?.title} />
            <span className="font-semibold truncate">{t.destination || t.client_name || 'Viagem'}</span>
            <Badge variant="outline" className={cn('shrink-0 text-[10px]', status.badge)}>{status.label}</Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {t.client_name || t.lead_name || 'Cliente'}{(t.airline || t.operator) && ` · ${t.airline || t.operator}`}
          </p>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          <Link
            href={`/app/${orgSlug}/reservas?sale=${t.id}`}
            className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
          >
            Ver viagem <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label="Mais ações" className="inline-flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:bg-muted transition-colors">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onOpenTrip(t)} className="cursor-pointer">
                <FileText className="w-3.5 h-3.5 mr-2" /> Ver detalhes
              </DropdownMenuItem>
              {wa && (
                <DropdownMenuItem asChild className="cursor-pointer">
                  <a href={wa} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="w-3.5 h-3.5 mr-2" /> WhatsApp
                  </a>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground pl-14">
        <CalendarDays className={cn('w-3.5 h-3.5 shrink-0', DATE_ICON_COLOR[status.key])} />
        {fmtDate(t.departure_date)} — {fmtDate(t.return_date)}
        {t.destination && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {t.destination}</span>}
      </div>

      {/* Responsável / Localizador / Valor */}
      <div className="grid grid-cols-3 gap-2 text-xs pl-14">
        <div>
          <p className="text-muted-foreground">Responsável</p>
          <p className="font-medium truncate flex items-center gap-1"><UserRound className="w-3 h-3 shrink-0" /> {sellerName || '—'}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Localizador</p>
          <button type="button" onClick={copyLocator} disabled={!locator} className="font-medium flex items-center gap-1 disabled:cursor-default hover:text-primary transition-colors">
            {locator || '—'} {locator && <ClipboardCopy className="w-3 h-3" />}
          </button>
        </div>
        <div>
          <p className="text-muted-foreground">Valor da viagem</p>
          <p className="font-medium">{formatCurrency(t.total_cents || 0)}</p>
        </div>
      </div>

      {/* Itens inclusos — mini-cards, quebrando linha conforme o espaço. */}
      {t.included_items.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pl-14">
          {t.included_items.map(key => {
            const meta = INCLUDED_META[key]
            if (!meta) return null
            const Icon = meta.icon
            return (
              <span key={key} className="inline-flex items-center gap-1 px-2 h-6 rounded-md bg-muted/50 text-[11px] text-muted-foreground">
                <Icon className="w-3 h-3" /> {meta.label}
              </span>
            )
          })}
        </div>
      )}

      {/* Barra Ida → Volta (anexo 3) */}
      <div className="pl-14">
        <ScheduleTripTimelineBar departure={dep} returnDate={ret} destination={t.destination} clientName={t.client_name} />
      </div>

      {/* Itinerário */}
      {t.flights.length > 0 && (
        <div className="pl-14 space-y-2">
          <button type="button" onClick={() => setItineraryOpen(v => !v)} className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground/80">
            <Plane className="w-3.5 h-3.5" /> Itinerário
            <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', itineraryOpen && 'rotate-180')} />
          </button>
          {itineraryOpen && (
            <div className="grid sm:grid-cols-2 gap-3">
              {idaLegs.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Ida · {fmtDate(t.departure_date)}</p>
                  {idaLegs.map((f, i) => (
                    <FlightLeg key={i} leg={f} showConnection={i > 0 ? connectionLabel(idaLegs[i - 1], f) : null} />
                  ))}
                </div>
              )}
              {voltaLegs.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Volta · {fmtDate(t.return_date)}</p>
                  {voltaLegs.map((f, i) => (
                    <FlightLeg key={i} leg={f} showConnection={i > 0 ? connectionLabel(voltaLegs[i - 1], f) : null} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
