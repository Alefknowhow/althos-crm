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

function parseDate(s?: string | null): Date | null {
  if (!s) return null
  const d = new Date(s + 'T12:00:00')
  return isNaN(d.getTime()) ? null : d
}
function fmtDate(s?: string | null) {
  const d = parseDate(s)
  return d ? d.toLocaleDateString('pt-BR') : '—'
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
        const meta = STATE_META[state]
        const dep = parseDate(t.departure_date)
        const wa = whatsappLink(t.lead_phone)
        const locator = t.package_locator || t.air_locator
        const seller = members.find(m => m.user_id === t.created_by)?.name

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
                    <span className={cn('w-2 h-2 rounded-full shrink-0', meta.dot)} />
                    <span className="font-medium truncate">{t.client_name || t.lead_name || 'Viagem'}</span>
                    <Badge variant="outline" className={cn('shrink-0 text-[10px]', meta.badge)}>{stateLabel(state, dep, today)}</Badge>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-muted-foreground">
                    {t.destination && (
                      <span className="inline-flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 shrink-0" /> <span className="truncate">{t.destination}</span>
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 shrink-0">
                      <CalendarDays className="w-3 h-3" /> {fmtDate(t.departure_date)} – {fmtDate(t.return_date)}
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
