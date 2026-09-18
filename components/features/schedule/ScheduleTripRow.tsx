'use client'

/**
 * Uma linha da tabela de Gestão de Viagens (visualização Lista) — layout
 * fiel ao mockup: VIAGEM/CLIENTE · DATAS/DESTINO · VOO DE IDA · VOO DE
 * VOLTA · SERVIÇOS · TAREFAS · AÇÃO. Extraído de ScheduleListView.tsx.
 */

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  Plane, Hotel, Car, Ship, ShieldCheck, Compass, Ticket, Package,
  MessageCircle, MoreHorizontal, ClipboardCopy, FileText, ExternalLink,
} from 'lucide-react'
import { toast } from 'sonner'
import type { ScheduledTrip, FlightLegInfo, OtherProductSummary } from '@/actions/travel-schedule'
import { whatsappLink, FLIGHT_STATUS_META } from './ScheduleTripDetail'

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

// Aéreo sempre aparece primeiro (é o serviço-âncora da viagem).
const SERVICE_ORDER = ['aereo', 'hospedagem', 'transfer', 'ingresso', 'veiculo', 'seguro', 'cruzeiro']

function parseDate(s?: string | null): Date | null {
  if (!s) return null
  const d = new Date(s + 'T12:00:00')
  return isNaN(d.getTime()) ? null : d
}
function fmtShort(s?: string | null) {
  const d = parseDate(s)
  return d ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '') : '—'
}
function daysUntil(dep: Date | null, today: Date): number | null {
  if (!dep) return null
  return Math.round((dep.getTime() - today.getTime()) / 86400000)
}

/** Etiqueta "Em N dias" — prioridade visual maior quanto mais próximo do
 *  embarque (pedido explícito do redesign). */
function DepartureBadge({ days }: { days: number | null }) {
  if (days === null) return <span className="text-xs text-muted-foreground">—</span>
  let cls = 'bg-muted text-muted-foreground border-transparent'
  let label = `Em ${days} dias`
  if (days < 0) { label = 'Embarcada'; cls = 'bg-muted text-muted-foreground border-transparent' }
  else if (days === 0) { label = 'Hoje'; cls = 'bg-destructive text-destructive-foreground border-transparent' }
  else if (days === 1) { label = 'Amanhã'; cls = 'bg-destructive text-destructive-foreground border-transparent' }
  else if (days <= 3) cls = 'bg-destructive text-destructive-foreground border-transparent'
  else if (days <= 7) cls = 'bg-warning text-warning-foreground border-transparent'
  else if (days <= 15) cls = 'bg-amber-100 text-amber-800 border-transparent dark:bg-amber-500/15 dark:text-amber-400'
  else cls = 'bg-muted text-muted-foreground border-transparent'
  return <Badge variant="outline" className={cn('text-[10px] font-medium px-1.5 py-0 whitespace-nowrap', cls)}>{label}</Badge>
}

/** Círculo com as iniciais da companhia — substitui o logotipo (não há
 *  base de logos de companhias aéreas no Althos; a cia é texto livre). */
function AirlineMark({ name }: { name: string | null }) {
  const initials = (name || '—').trim().slice(0, 2).toUpperCase()
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-[9px] font-bold shrink-0">
      {initials}
    </span>
  )
}

function connectionLabel(legs: FlightLegInfo[]): string | null {
  const stops = legs.length > 1
    ? legs.slice(0, -1).map((l, i) => legs[i + 1].conexao_local || l.destino).filter(Boolean)
    : (legs[0]?.conexao_local ? [legs[0].conexao_local] : [])
  if (stops.length === 0) return null
  return `${stops.length} conexão${stops.length > 1 ? 'ões' : ''} (${stops.join(', ')})`
}

/** Duração total do trecho (partida do 1º voo → chegada do último) —
 *  mostrada na linha origem→destino do bloco de voo. */
function totalDuration(first: FlightLegInfo, last: FlightLegInfo): string | null {
  if (!first.data || !first.horario) return null
  const arrDate = last.data_chegada || last.data
  const arrTime = last.horario_chegada || last.horario
  if (!arrDate || !arrTime) return null
  const dep = new Date(`${first.data}T${first.horario}`).getTime()
  const arr = new Date(`${arrDate}T${arrTime}`).getTime()
  if (isNaN(dep) || isNaN(arr) || arr <= dep) return null
  const mins = Math.round((arr - dep) / 60000)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h${m > 0 ? `${m}m` : ''}`
}

/** Bloco de voo (ida ou volta) — 4 linhas fixas, cada uma em grid de
 *  colunas (não flex de largura variável) pra manter tudo alinhado mesmo
 *  quando o conteúdo muda de tamanho entre um voo e outro:
 *  1. Cia + número | localizador (etiqueta) | status (etiqueta)
 *  2. Data de embarque  —  data de chegada
 *  3. Origem (destaque) + horário (menor/apagado)  →  destino (destaque) + horário (menor/apagado) + duração
 *  4. Conexão, em etiqueta — só quando houver */
function FlightBlock({ legs, locator }: { legs: FlightLegInfo[]; locator: string | null }) {
  if (legs.length === 0) return <span className="text-xs text-muted-foreground">—</span>
  const first = legs[0]
  const last = legs[legs.length - 1]
  const numero = Array.from(new Set(legs.map(l => l.numero_voo).filter(Boolean))).join(' + ') || '—'
  const worst = (['cancelled', 'diverted', 'active', 'scheduled', 'unknown', 'landed'] as const)
    .find(s => legs.some(l => l.status === s)) || 'scheduled'
  const meta = FLIGHT_STATUS_META[worst]
  const delay = legs.reduce((sum, l) => sum + (l.delay_minutes || 0), 0)
  const conn = connectionLabel(legs)
  const duration = totalDuration(first, last)
  const arrivalDate = last.data_chegada || last.data
  const nextDayArrival = arrivalDate && first.data && arrivalDate !== first.data

  function copy() {
    if (!locator) return
    navigator.clipboard.writeText(locator).then(() => toast.success('Localizador copiado.'))
  }

  return (
    <div className="min-w-[210px] w-fit rounded-lg border bg-muted/10 px-2.5 py-2 space-y-1 text-xs">
      {/* Linha 1 — cia + número | localizador | status */}
      <div className="flex flex-wrap items-center gap-1.5">
        <AirlineMark name={first.companhia} />
        <span className="font-semibold">{first.companhia || 'Cia não informada'}</span>
        <span className="text-muted-foreground">{numero}</span>
        {locator && <span className="text-muted-foreground/40">|</span>}
        {locator && (
          <button
            type="button"
            onClick={copy}
            title="Copiar localizador"
            className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity"
          >
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-mono font-medium">{locator}</Badge>
            <ClipboardCopy className="w-3 h-3 text-muted-foreground" />
          </button>
        )}
        <span className="text-muted-foreground/40">|</span>
        <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0', meta?.badge)}>
          {meta?.label}{delay > 0 ? ` +${Math.floor(delay / 60)}h${delay % 60 || ''}` : ''}
        </Badge>
      </div>

      {/* Linha 2 — data de embarque — data de chegada — colunas de largura fixa,
          coladas (sem esticar pra largura do card), pra ficar no mesmo lugar
          em toda linha da tabela. */}
      <div className="flex items-center gap-1 text-muted-foreground whitespace-nowrap">
        <span>{fmtShort(first.data)}</span>
        <span>—</span>
        <span>
          {fmtShort(arrivalDate)}
          {nextDayArrival && <sup className="text-primary font-semibold ml-0.5">+1</sup>}
        </span>
      </div>

      {/* Linha 3 — origem+horário → destino+horário (duração) — mesma lógica
          de colunas fixas e coladas, horário do lado do código do aeroporto. */}
      <div className="grid grid-cols-[30px_38px_14px_30px_38px_auto] items-baseline gap-x-1 tabular-nums whitespace-nowrap">
        <span className="font-bold text-foreground">{first.origem || '—'}</span>
        <span className="text-[10px] font-normal text-muted-foreground">{first.horario || ''}</span>
        <span className="text-center text-muted-foreground">→</span>
        <span className="font-bold text-foreground">{last.destino || '—'}</span>
        <span className="text-[10px] font-normal text-muted-foreground">{last.horario_chegada || ''}</span>
        <span className="text-[10px] font-normal text-muted-foreground">{duration ? `(${duration})` : ''}</span>
      </div>

      {/* Linha 4 — conexão, em etiqueta, só quando houver */}
      {conn && (
        <div>
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-normal text-muted-foreground">
            {conn}
          </Badge>
        </div>
      )}
    </div>
  )
}

function ServiceIcons({ items, hasFlights }: { items: OtherProductSummary[]; hasFlights: boolean }) {
  const byKind = new Map<string, OtherProductSummary>()
  if (hasFlights) byKind.set('aereo', { id: 'aereo', kind: 'aereo', title: 'Aéreo', subtitle: null })
  for (const it of items) if (!byKind.has(it.kind)) byKind.set(it.kind, it)
  const ordered = Array.from(byKind.values()).sort(
    (a, b) => SERVICE_ORDER.indexOf(a.kind) - SERVICE_ORDER.indexOf(b.kind),
  )
  if (ordered.length === 0) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex items-center gap-1.5">
        {ordered.map(item => {
          const meta = OTHER_KIND_META[item.kind] || (item.kind === 'aereo' ? { label: 'Aéreo', icon: Plane } : OTHER_KIND_META.outro)
          const Icon = meta.icon
          return (
            <Tooltip key={item.kind}>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-primary/10 text-primary">
                  <Icon className="w-3.5 h-3.5" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">{item.title || meta.label}</TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
}

function TaskProgress({ done, total, health }: { done: number; total: number; health: 'green' | 'yellow' | 'red' }) {
  if (total === 0) return <span className="text-xs text-muted-foreground">—</span>
  const pct = Math.round((done / total) * 100)
  const barColor = health === 'green' ? 'bg-emerald-500' : health === 'yellow' ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="w-20 space-y-1">
      <span className="text-xs font-medium tabular-nums">{done}/{total}</span>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full', barColor)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function ScheduleTripRow({
  orgSlug, t, today, onOpenTrip,
}: {
  orgSlug: string
  t: ScheduledTrip
  today: Date
  onOpenTrip: (t: ScheduledTrip) => void
}) {
  const dep = parseDate(t.departure_date)
  const days = daysUntil(dep, today)
  const wa = whatsappLink(t.lead_phone)
  const locator = t.package_locator || t.air_locator || null

  const ida = t.flights.filter(f => f.sentido !== 'volta')
  const volta = t.flights.filter(f => f.sentido === 'volta')

  return (
    <tr className="border-b last:border-b-0 hover:bg-muted/30 transition-colors align-top">
      {/* Embarque — separado do cliente, início da linha */}
      <td className="py-3 pl-4 pr-2 min-w-[76px]">
        <DepartureBadge days={days} />
      </td>

      {/* Viagem / Cliente */}
      <td className="py-3 px-3 min-w-[170px]">
        <div className="space-y-1">
          <button type="button" onClick={() => onOpenTrip(t)} className="block font-semibold text-sm hover:underline truncate max-w-[160px] text-left">
            {t.client_name || t.lead_name || 'Cliente'}
          </button>
          <p className="text-xs text-muted-foreground">
            {t.included_items.length || 1} viajante{(t.included_items.length || 1) !== 1 ? 's' : ''}
          </p>
          {locator && <p className="text-xs text-muted-foreground">Res. #{locator}</p>}
        </div>
      </td>

      {/* Datas / Destino */}
      <td className="py-3 px-3 min-w-[140px]">
        <div className="space-y-1 text-xs">
          <p className="font-medium tabular-nums">{fmtShort(t.departure_date)} → {fmtShort(t.return_date)}</p>
          <p className="flex items-center gap-1.5">
            {t.destination_flag && <span>{t.destination_flag}</span>}
            <span className="font-semibold text-sm">{t.destination || '—'}</span>
          </p>
          {t.destination_country && <p className="text-muted-foreground">{t.destination_country}</p>}
        </div>
      </td>

      {/* Voo de ida */}
      <td className="py-3 px-3"><FlightBlock legs={ida} locator={t.air_locator || locator} /></td>

      {/* Voo de volta */}
      <td className="py-3 px-3"><FlightBlock legs={volta} locator={t.air_locator || locator} /></td>

      {/* Serviços */}
      <td className="py-3 px-3"><ServiceIcons items={t.other_items} hasFlights={t.flights.length > 0} /></td>

      {/* Tarefas */}
      <td className="py-3 px-3"><TaskProgress done={t.tasks_done} total={t.tasks_total} health={t.health} /></td>

      {/* Ação */}
      <td className="py-3 pl-3 pr-4">
        <div className="flex items-center gap-1.5 justify-end">
          <button
            type="button"
            onClick={() => onOpenTrip(t)}
            className="inline-flex items-center h-8 px-2.5 rounded-md border text-xs font-medium text-primary hover:bg-primary/10 transition-colors whitespace-nowrap"
          >
            Ver viagem
          </button>
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
              <DropdownMenuItem asChild className="cursor-pointer">
                <Link href={`/app/${orgSlug}/reservas?sale=${t.id}`}>
                  <ExternalLink className="w-3.5 h-3.5 mr-2" /> Abrir reserva
                </Link>
              </DropdownMenuItem>
              {wa && (
                <DropdownMenuItem asChild className="cursor-pointer">
                  <a href={wa} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="w-3.5 h-3.5 mr-2" /> WhatsApp
                  </a>
                </DropdownMenuItem>
              )}
              {locator && (
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => navigator.clipboard.writeText(locator).then(() => toast.success('Localizador copiado.'))}
                >
                  <ClipboardCopy className="w-3.5 h-3.5 mr-2" /> Copiar localizador
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </td>
    </tr>
  )
}
