import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { listUpcomingDepartures } from '@/actions/travel-schedule'
import { formatCurrency } from '@/lib/utils'
import {
  Plane, MessageCircle, ArrowRight, ArrowUpRight, Hotel, CalendarClock, Ticket,
} from 'lucide-react'

const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function parseDate(s?: string | null): Date | null {
  if (!s) return null
  const d = new Date(s + 'T12:00:00')
  return isNaN(d.getTime()) ? null : d
}

function fmtShortDate(d: Date | null): string | null {
  if (!d) return null
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function daysUntil(d: Date, today: Date): number {
  return Math.round((d.getTime() - today.getTime()) / 86400000)
}

function relativeLabel(n: number): string {
  if (n === 0) return 'Hoje'
  if (n === 1) return 'Amanhã'
  return `Em ${n} dias`
}

function whatsappLink(phone?: string | null): string | null {
  if (!phone) return null
  let digits = phone.replace(/\D/g, '')
  if (!digits) return null
  if (digits.length === 10 || digits.length === 11) digits = '55' + digits
  return `https://wa.me/${digits}`
}

export default async function UpcomingDeparturesWidget({ orgSlug }: { orgSlug: string }) {
  const trips = await listUpcomingDepartures(orgSlug, 7)
  const today = new Date(); today.setHours(0, 0, 0, 0)

  return (
    <Card className="reveal">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base tracking-apple-tighter flex items-center gap-1.5">
          <Plane className="w-4 h-4 text-primary" /> Embarques (próximos 7 dias)
        </CardTitle>
        <Link
          href={`/app/${orgSlug}/embarques`}
          className="text-xs text-primary hover:text-primary/80 font-medium tracking-apple-snug inline-flex items-center gap-0.5 transition-colors"
        >
          Ver todos <ArrowRight className="w-3 h-3" />
        </Link>
      </CardHeader>
      <CardContent>
        {trips.length === 0 ? (
          <div className="text-sm text-muted-foreground p-6 text-center border border-dashed border-border rounded-xl tracking-apple-snug">
            Nenhum embarque nos próximos 7 dias
          </div>
        ) : (
          <div className="space-y-2">
            {trips.map(trip => {
              const dep = parseDate(trip.departure_date)
              const ret = parseDate(trip.return_date)
              const n = dep ? daysUntil(dep, today) : null
              const wa = whatsappLink(trip.lead_phone)
              const locator = trip.package_locator || trip.air_locator

              return (
                <div key={trip.id} className="rounded-lg border p-2.5 hover:bg-muted/40 transition-colors space-y-1.5">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center justify-center w-11 h-11 shrink-0 rounded-lg bg-primary/10 text-primary">
                      <span className="text-[10px] leading-none uppercase font-medium">
                        {dep ? MONTHS_PT[dep.getMonth()] : ''}
                      </span>
                      <span className="text-sm leading-tight font-semibold">
                        {dep ? dep.getDate() : '—'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {trip.client_name || trip.lead_name || 'Cliente'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {trip.destination || 'Destino não informado'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {n != null && (
                        <Badge
                          variant="outline"
                          className={n <= 1 ? 'text-[10px] px-1.5 h-5 bg-destructive/10 text-destructive border-destructive/20' : 'text-[10px] px-1.5 h-5'}
                        >
                          {relativeLabel(n)}
                        </Badge>
                      )}
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
                        href={`/app/${orgSlug}/reservas?sale=${trip.id}`}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md text-primary hover:bg-primary/10 transition-colors"
                        aria-label="Abrir reserva"
                        title="Abrir reserva"
                      >
                        <ArrowUpRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>

                  {(ret || trip.hotel_name || trip.airline || trip.operator || locator || trip.total_cents > 0) && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-14 text-[11px] text-muted-foreground">
                      {ret && (
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock className="w-3 h-3" /> Volta {fmtShortDate(ret)}
                        </span>
                      )}
                      {trip.hotel_name && (
                        <span className="inline-flex items-center gap-1 truncate max-w-[160px]">
                          <Hotel className="w-3 h-3" /> {trip.hotel_name}
                        </span>
                      )}
                      {(trip.airline || trip.operator) && (
                        <span className="inline-flex items-center gap-1 truncate max-w-[160px]">
                          <Plane className="w-3 h-3" /> {trip.airline || trip.operator}
                        </span>
                      )}
                      {locator && (
                        <span className="inline-flex items-center gap-1">
                          <Ticket className="w-3 h-3" /> {locator}
                        </span>
                      )}
                      {trip.total_cents > 0 && (
                        <span className="font-medium text-foreground/80">
                          {formatCurrency(trip.total_cents)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
