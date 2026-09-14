'use client'

/**
 * Card de viagem do painel de Embarques — layout de 4 linhas, guiado pela
 * especificação detalhada do redesign:
 *  1. Data (badge estilo calendário) · bola de saúde · destino · "|" ·
 *     etiqueta de status ("Faltam X dias"/"Em andamento"/"Concluída") ·
 *     ações (Ver viagem/"...") à direita.
 *  2. Ida/Volta/Responsável/Cliente/Operadora/Localizador, numa barra só.
 *  3. Uma etiqueta por sentido de voo (Ida/Volta/...), cada uma compacta
 *     mas com nº do voo, data+horário de partida, sigla de origem,
 *     conexão(ões) com tempo de espera quando houver, data+horário de
 *     chegada, sigla de destino, e badge de status colorida — todas na
 *     mesma linha (flex-wrap), sem coluna fixa por sentido.
 *  4. Uma etiqueta por item contratado que não é voo (hospedagem/
 *     transfer/ingresso/etc.), com os detalhes mais relevantes de cada um.
 * Ocupa a largura cheia da tela (1 card por linha — ver ScheduleListView).
 * Extraído de ScheduleListView.tsx.
 */

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import {
  Plane, Hotel, Car, Ship, ShieldCheck, Compass, Ticket, Package,
  MessageCircle, ArrowUpRight, MoreHorizontal, ClipboardCopy, FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import type { ScheduledTrip, FlightLegInfo, OtherProductSummary } from '@/actions/travel-schedule'
import { type TripState } from './ScheduleGanttView'
import {
  whatsappLink, rowStatus, HEALTH_META, FLIGHT_STATUS_META,
} from './ScheduleTripDetail'

const OTHER_KIND_META: Record<string, { label: string; icon: typeof Plane }> = {
  hospedagem: { label: 'Hospedagem', icon: Hotel },
  transfer: { label: 'Transfer', icon: Car },
  cruzeiro: { label: 'Cruzeiro', icon: Ship },
  seguro: { label: 'Seguro', icon: ShieldCheck },
  passeio: { label: 'Passeio', icon: Compass },
  veiculo: { label: 'Locação de veículo', icon: Car },
  ingresso: { label: 'Ingresso', icon: Ticket },
  outro: { label: 'Outro', icon: Package },
}

const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

// Pior status primeiro — se algum trecho do grupo estiver nesse estado,
// é ele que aparece na etiqueta do sentido inteiro (o que precisa de mais
// atenção nunca fica escondido atrás de um trecho tranquilo).
const STATUS_PRIORITY: NonNullable<FlightLegInfo['status']>[] = ['cancelled', 'diverted', 'active', 'scheduled', 'unknown', 'landed']

function parseDate(s?: string | null): Date | null {
  if (!s) return null
  const d = new Date(s + 'T12:00:00')
  return isNaN(d.getTime()) ? null : d
}
function fmtDate(s?: string | null) {
  const d = parseDate(s)
  return d ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'
}

/** Tempo de conexão entre a chegada de um trecho e a partida do próximo. */
function connectionDuration(a: FlightLegInfo, b: FlightLegInfo): string | null {
  const arrDate = a.data_chegada || a.data
  const arrTime = a.horario_chegada || a.horario
  if (!arrDate || !arrTime || !b.data || !b.horario) return null
  const ta = new Date(`${arrDate}T${arrTime}`).getTime()
  const tb = new Date(`${b.data}T${b.horario}`).getTime()
  if (isNaN(ta) || isNaN(tb) || tb <= ta) return null
  const mins = Math.round((tb - ta) / 60000)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h > 0 ? `${h}h` : ''}${m > 0 ? `${m}min` : ''}`.trim() || null
}

/** Uma etiqueta por sentido de voo (Ida/Volta/...) — condensa todos os
 *  trechos daquele sentido (com conexões) numa linha só. */
function FlightGroupTag({ sentido, legs }: { sentido: string; legs: FlightLegInfo[] }) {
  const first = legs[0]
  const last = legs[legs.length - 1]
  const numero = Array.from(new Set(legs.map(l => l.numero_voo).filter(Boolean))).join(' + ') || '—'
  const worstStatus = STATUS_PRIORITY.find(s => legs.some(l => l.status === s)) || 'scheduled'
  const meta = FLIGHT_STATUS_META[worstStatus]
  const delay = legs.reduce((sum, l) => sum + (l.delay_minutes || 0), 0)

  return (
    <div className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border bg-muted/20 px-3 py-2 text-xs">
      <Plane className="w-3.5 h-3.5 text-primary shrink-0" />
      <span className="font-semibold capitalize shrink-0">{sentido}</span>
      <span className="text-muted-foreground shrink-0">{numero}</span>
      <span className="text-muted-foreground">
        {fmtDate(first.data)} {first.horario || ''} {first.origem || '—'}
      </span>
      {legs.slice(0, -1).map((leg, i) => {
        const dur = connectionDuration(leg, legs[i + 1])
        return (
          <span key={leg.id} className="text-muted-foreground italic">
            → {leg.destino || '—'}{dur ? ` (${dur})` : ''}
          </span>
        )
      })}
      <span className="text-muted-foreground">
        → {fmtDate(last.data_chegada || last.data)} {last.horario_chegada || ''} {last.destino || '—'}
      </span>
      <Badge variant="outline" className={cn('text-[9px] px-1 py-0 shrink-0', meta?.badge)}>
        {meta?.label}{delay > 0 ? ` +${delay}min` : ''}
      </Badge>
    </div>
  )
}

/** Uma etiqueta por item contratado que não é voo — resumida (título +
 *  detalhe principal), sem repetir tudo que já fica em Reservas › Produtos. */
function OtherItemTag({ item }: { item: OtherProductSummary }) {
  const meta = OTHER_KIND_META[item.kind] || OTHER_KIND_META.outro
  const Icon = meta.icon
  return (
    <div className="inline-flex items-center gap-1.5 rounded-md border bg-muted/20 px-3 py-2 text-xs">
      <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
      <span className="font-medium">{item.title}</span>
      {item.subtitle && <span className="text-muted-foreground">· {item.subtitle}</span>}
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
  const state = tripState(t, today)
  const dep = parseDate(t.departure_date)
  const wa = whatsappLink(t.lead_phone)
  const locator = t.package_locator || t.air_locator
  const status = rowStatus(t, state, dep, today)

  const flightGroups = Array.from(
    t.flights.reduce((map, f) => {
      const key = f.sentido || 'ida'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(f)
      return map
    }, new Map<string, FlightLegInfo[]>()),
  )

  function copyLocator() {
    if (!locator) return
    navigator.clipboard.writeText(locator).then(() => toast.success('Localizador copiado.'))
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3 w-full">
      {/* Linha 1 */}
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-center justify-center w-11 h-11 shrink-0 rounded-lg bg-primary/10 text-primary">
          <span className="text-[10px] leading-none uppercase font-medium">{dep ? MONTHS_PT[dep.getMonth()] : ''}</span>
          <span className="text-sm leading-tight font-semibold">{dep ? dep.getDate() : '—'}</span>
        </div>

        <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', HEALTH_META[t.health]?.dot)} title={HEALTH_META[t.health]?.title} />

        <button type="button" onClick={() => onOpenTrip(t)} className="font-semibold truncate hover:underline">
          {t.destination || t.client_name || 'Viagem'}
        </button>

        <span className="text-muted-foreground shrink-0">|</span>
        <Badge variant="outline" className={cn('shrink-0 text-[10px]', status.badge)}>{status.label}</Badge>

        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
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

      {/* Linha 2 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md border bg-muted/20 px-3 py-2 text-xs">
        <span><span className="text-muted-foreground">Ida:</span> <span className="font-medium">{fmtDate(t.departure_date)}</span></span>
        <span><span className="text-muted-foreground">Volta:</span> <span className="font-medium">{fmtDate(t.return_date)}</span></span>
        <span><span className="text-muted-foreground">Responsável:</span> <span className="font-medium">{sellerName || '—'}</span></span>
        <span><span className="text-muted-foreground">Cliente:</span> <span className="font-medium">{t.client_name || t.lead_name || '—'}</span></span>
        <span><span className="text-muted-foreground">Operadora:</span> <span className="font-medium">{t.operator || t.airline || '—'}</span></span>
        <button type="button" onClick={copyLocator} disabled={!locator} className="inline-flex items-center gap-1 disabled:cursor-default hover:text-primary transition-colors">
          <span className="text-muted-foreground">Localizador:</span> <span className="font-medium">{locator || '—'}</span>
          {locator && <ClipboardCopy className="w-3 h-3" />}
        </button>
      </div>

      {/* Linha 3 — uma etiqueta por sentido, todas na mesma linha */}
      {flightGroups.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {flightGroups.map(([sentido, legs]) => <FlightGroupTag key={sentido} sentido={sentido} legs={legs} />)}
        </div>
      )}

      {/* Linha 4 — demais itens contratados */}
      {t.other_items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {t.other_items.map(item => <OtherItemTag key={item.id} item={item} />)}
        </div>
      )}
    </div>
  )
}
