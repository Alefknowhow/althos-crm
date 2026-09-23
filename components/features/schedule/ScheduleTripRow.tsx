'use client'

/**
 * Uma linha da lista de Embarques — layout definitivo da issue #9:
 * Embarque → Cliente/destino → Período → Voo de ida → Voo de volta →
 * Serviços → Pendências → Ações. Sem cartões dentro de célula — só
 * divisores horizontais (borda da linha) e alinhamento por coluna.
 * Extraído de ScheduleListView.tsx.
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
  Plane, Hotel, Car, Ship, ShieldCheck, Ticket, TrainFront, Smartphone,
  MessageCircle, MoreHorizontal, ClipboardCopy, FileText, ExternalLink, CheckCircle2, AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import type { ScheduledTrip } from '@/actions/travel-schedule'
import { whatsappLink } from './ScheduleTripDetail'
import { FlightBlock } from './ScheduleFlightBlock'
import { tripState } from './schedule-phase'
import { STATE_META } from './ScheduleGanttView'

/** Grade fixa 4×2 = 8 posições de Serviços (issue #9 § 3.6) — ordem e
 *  categorias são definitivas, não dependem do que a reserva tem contratado.
 *  "Trem" e "Chip de telefone" ainda não existem como tipo de produto no
 *  módulo Reservas (só aéreo/hospedagem/transfer/passeio/cruzeiro/seguro/
 *  ingresso/veículo/outro) — a posição fica reservada e sempre inativa até
 *  esse tipo de produto existir. */
const SERVICE_GRID: { kind: string; label: string; icon: typeof Plane }[] = [
  { kind: 'aereo', label: 'Aéreo', icon: Plane },
  { kind: 'hospedagem', label: 'Hospedagem', icon: Hotel },
  { kind: 'cruzeiro', label: 'Cruzeiro', icon: Ship },
  { kind: 'ingresso', label: 'Ingressos', icon: Ticket },
  { kind: 'transfer', label: 'Transfer', icon: Car },
  { kind: 'trem', label: 'Trem', icon: TrainFront },
  { kind: 'seguro', label: 'Seguro viagem', icon: ShieldCheck },
  { kind: 'chip', label: 'Chip de telefone', icon: Smartphone },
]

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

const RED_BADGE = 'bg-destructive text-destructive-foreground border-transparent'

/** Etiqueta/cor do estado de embarque (issue #9 § 3.1): Em N dias / Amanhã /
 *  Hoje / Em andamento / Concluída — extraído pra manter o componente
 *  enxuto. */
function embarqueBadge(t: ScheduledTrip, days: number, state: ReturnType<typeof tripState>) {
  if (t.status === 'cancelled') return { label: 'Cancelada', cls: RED_BADGE }
  if (state === 'ongoing') return { label: STATE_META.ongoing.label, cls: 'bg-success text-success-foreground border-transparent' }
  if (state === 'past') return { label: STATE_META.past.label, cls: 'bg-muted text-muted-foreground border-transparent' }
  if (days === 0) return { label: 'Hoje', cls: RED_BADGE }
  if (days === 1) return { label: 'Amanhã', cls: RED_BADGE }
  return {
    label: `Em ${days} dias`,
    cls: days <= 7 ? 'bg-warning text-warning-foreground border-transparent' : 'bg-muted text-muted-foreground border-transparent',
  }
}

/** Embarque — data + etiqueta/contador (issue #9 § 3.1). */
function EmbarqueCell({ t, today }: { t: ScheduledTrip; today: Date }) {
  const dep = parseDate(t.departure_date)
  if (!dep) return <span className="text-xs text-muted-foreground">—</span>
  const days = daysUntil(dep, today) ?? 0
  const { label, cls } = embarqueBadge(t, days, tripState(t, today))

  return (
    <div className="space-y-1">
      <p className="text-sm font-medium tabular-nums">{fmtShort(t.departure_date)}</p>
      <Badge variant="outline" className={cn('text-[10px] font-medium px-1.5 py-0 whitespace-nowrap', cls)}>{label}</Badge>
    </div>
  )
}

/** Cliente / destino — 3 linhas fixas (issue #9 § 3.2). */
function ClienteDestinoCell({ t, onOpenTrip }: { t: ScheduledTrip; onOpenTrip: (t: ScheduledTrip) => void }) {
  const locator = t.package_locator
  return (
    <div className="space-y-0.5 max-w-[220px]">
      <button type="button" onClick={() => onOpenTrip(t)} className="block font-semibold text-sm hover:underline truncate text-left">
        {t.client_name || t.lead_name || 'Cliente'}
      </button>
      <p className="text-xs text-muted-foreground truncate">
        {t.destination_flag && <span className="mr-1">{t.destination_flag}</span>}
        {t.destination || 'Destino não informado'}
        {t.destination_country && `, ${t.destination_country}`}
        {' · '}{t.travelers_count} viajante{t.travelers_count !== 1 ? 's' : ''}
      </p>
      {(t.operator || locator) && (
        <p className="text-xs text-muted-foreground truncate">
          {t.operator || 'Sem operadora'}{locator ? ` · OP ${locator}` : ''}
        </p>
      )}
    </div>
  )
}

/** Serviços — grade fixa 4×2, posições estáveis (issue #9 § 3.6). */
function ServicesGrid({ t }: { t: ScheduledTrip }) {
  const activeKinds = new Set(t.other_items.map(i => i.kind))
  if (t.flights.length > 0) activeKinds.add('aereo')
  const titleByKind = new Map(t.other_items.map(i => [i.kind, i.title]))

  return (
    <TooltipProvider delayDuration={150}>
      <div className="grid grid-cols-4 grid-rows-2 gap-1 w-fit">
        {SERVICE_GRID.map(svc => {
          const active = activeKinds.has(svc.kind)
          const Icon = svc.icon
          return (
            <Tooltip key={svc.kind}>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    'inline-flex items-center justify-center w-6 h-6 rounded-md',
                    active ? 'bg-primary/10 text-primary' : 'bg-muted/40 text-muted-foreground/40',
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {active ? (titleByKind.get(svc.kind) || svc.label) : `${svc.label} — não contratado`}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
}

/** Pendências — resumo de tarefas da reserva (issue #9 § 3.7). Clique abre
 *  a aba Tarefas do painel (não apenas Produtos, o padrão do resto da
 *  linha). */
function PendenciasCell({ t, onOpenTrip }: { t: ScheduledTrip; onOpenTrip: (t: ScheduledTrip, tab?: 'tarefas') => void }) {
  if (t.tasks_total === 0) {
    return (
      <button type="button" onClick={() => onOpenTrip(t, 'tarefas')} className="text-xs text-muted-foreground hover:underline">
        Sem tarefas
      </button>
    )
  }
  const pending = t.tasks_total - t.tasks_done
  const pct = Math.round((t.tasks_done / t.tasks_total) * 100)
  if (pending === 0) {
    return (
      <button type="button" onClick={() => onOpenTrip(t, 'tarefas')} className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 hover:underline">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Tudo pronto
      </button>
    )
  }
  const barColor = t.health === 'red' ? 'bg-red-500' : 'bg-amber-500'
  return (
    <button type="button" onClick={() => onOpenTrip(t, 'tarefas')} className="block w-24 text-left group">
      <span className="inline-flex items-center gap-1.5 text-xs group-hover:underline">
        {t.health === 'red' && <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-500" />}
        {t.tasks_done} de {t.tasks_total} concluídas
      </span>
      <span className="block h-1.5 w-full rounded-full bg-muted overflow-hidden mt-1">
        <span className={cn('block h-full rounded-full', barColor)} style={{ width: `${pct}%` }} />
      </span>
    </button>
  )
}

export function ScheduleTripRow({
  orgSlug, t, today, onOpenTrip,
}: {
  orgSlug: string
  t: ScheduledTrip
  today: Date
  onOpenTrip: (t: ScheduledTrip, tab?: 'tarefas') => void
}) {
  const wa = whatsappLink(t.lead_phone)
  const locator = t.package_locator || t.air_locator || null

  const ida = t.flights.filter(f => f.sentido !== 'volta')
  const volta = t.flights.filter(f => f.sentido === 'volta')

  return (
    <tr className="border-b last:border-b-0 hover:bg-muted/30 transition-colors align-top">
      <td className="py-3 pl-4 pr-3">
        <EmbarqueCell t={t} today={today} />
      </td>

      <td role="button" tabIndex={0} onClick={() => onOpenTrip(t)} onKeyDown={e => { if (e.key === 'Enter') onOpenTrip(t) }}
        className="py-3 px-3 cursor-pointer">
        <ClienteDestinoCell t={t} onOpenTrip={onOpenTrip} />
      </td>

      <td className="py-3 px-3 text-xs tabular-nums whitespace-nowrap">
        {fmtShort(t.departure_date)} → {t.return_date ? fmtShort(t.return_date) : '—'}
      </td>

      <td className="py-3 px-3"><FlightBlock legs={ida} locator={t.air_locator || locator} /></td>

      <td className="py-3 px-3"><FlightBlock legs={volta} locator={t.air_locator || locator} /></td>

      <td className="py-3 px-3">
        <ServicesGrid t={t} />
      </td>

      <td className="py-3 px-3">
        <PendenciasCell t={t} onOpenTrip={onOpenTrip} />
      </td>

      <td className="py-3 pl-3 pr-4">
        <div className="flex items-center justify-end">
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
