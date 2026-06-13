'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import EmptyState from '@/components/ui/empty-state'
import { cn, formatCurrency } from '@/lib/utils'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { getTripTasks, type ScheduledTrip, type TripTask } from '@/actions/travel-schedule'
import {
  CalendarClock, ChevronLeft, ChevronRight, MapPin, Plane, Hotel, MessageCircle,
  ExternalLink, CheckSquare, Loader2, CalendarDays, ListChecks, Ticket, Building2,
} from 'lucide-react'

const DAY = 86400000
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
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
function addMonths(d: Date, n: number) { const x = new Date(d); x.setMonth(x.getMonth() + n); return x }
function firstOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1) }

type TripState = 'upcoming' | 'ongoing' | 'past'
function tripState(t: ScheduledTrip, today: Date): TripState {
  const dep = parseDate(t.departure_date)
  const ret = parseDate(t.return_date) || dep
  if (!dep) return 'upcoming'
  const end = ret || dep
  if (end < today) return 'past'
  if (dep <= today && today <= end) return 'ongoing'
  return 'upcoming'
}

const STATE_META: Record<TripState, { label: string; bar: string; dot: string; badge: string }> = {
  upcoming: { label: 'Próxima', bar: 'bg-indigo-500', dot: 'bg-indigo-500', badge: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  ongoing: { label: 'Em andamento', bar: 'bg-emerald-500', dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  past: { label: 'Concluída', bar: 'bg-slate-400', dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600 border-slate-200' },
}

function whatsappLink(phone?: string | null): string | null {
  if (!phone) return null
  let digits = phone.replace(/\D/g, '')
  if (!digits) return null
  if (digits.length === 10 || digits.length === 11) digits = '55' + digits
  return `https://wa.me/${digits}`
}

export default function ScheduleClient({
  orgSlug, trips,
}: {
  orgSlug: string
  trips: ScheduledTrip[]
}) {
  const today = useMemo(() => startOfDay(new Date()), [])
  const [filter, setFilter] = useState<'all' | TripState>('all')
  const [monthOffset, setMonthOffset] = useState(0)
  const [selected, setSelected] = useState<ScheduledTrip | null>(null)
  const [tasks, setTasks] = useState<TripTask[]>([])
  const [loadingTasks, startTasks] = useTransition()

  const filtered = useMemo(() => {
    if (filter === 'all') return trips
    return trips.filter(t => tripState(t, today) === filter)
  }, [trips, filter, today])

  // Janela do gantt: 3 meses a partir do mês atual (+ offset)
  const windowStart = useMemo(() => firstOfMonth(addMonths(today, monthOffset)), [today, monthOffset])
  const windowEnd = useMemo(() => addMonths(windowStart, 3), [windowStart])
  const totalDays = Math.max(1, Math.round((windowEnd.getTime() - windowStart.getTime()) / DAY))

  const months = useMemo(() => {
    const out: { label: string; leftPct: number; widthPct: number }[] = []
    for (let i = 0; i < 3; i++) {
      const mStart = addMonths(windowStart, i)
      const mEnd = addMonths(mStart, 1)
      const left = (mStart.getTime() - windowStart.getTime()) / DAY / totalDays * 100
      const width = (mEnd.getTime() - mStart.getTime()) / DAY / totalDays * 100
      out.push({ label: `${MONTHS_PT[mStart.getMonth()]} ${mStart.getFullYear()}`, leftPct: left, widthPct: width })
    }
    return out
  }, [windowStart, totalDays])

  const todayPct = useMemo(() => {
    const p = (today.getTime() - windowStart.getTime()) / DAY / totalDays * 100
    return p >= 0 && p <= 100 ? p : null
  }, [today, windowStart, totalDays])

  // Trips que aparecem no gantt: que sobrepõem a janela
  const ganttTrips = useMemo(() => {
    return filtered.map(t => {
      const dep = parseDate(t.departure_date)
      const ret = parseDate(t.return_date) || dep
      if (!dep) return null
      const end = ret || dep
      // overlap test
      if (end < windowStart || dep >= windowEnd) return null
      const clampedStart = Math.max(dep.getTime(), windowStart.getTime())
      const clampedEnd = Math.min(end.getTime() + DAY, windowEnd.getTime()) // inclui o dia de retorno
      const left = (clampedStart - windowStart.getTime()) / DAY / totalDays * 100
      const width = Math.max(1.5, (clampedEnd - clampedStart) / DAY / totalDays * 100)
      return { trip: t, left, width, state: tripState(t, today) }
    }).filter(Boolean) as { trip: ScheduledTrip; left: number; width: number; state: TripState }[]
  }, [filtered, windowStart, windowEnd, totalDays, today])

  function openTrip(t: ScheduledTrip) {
    setSelected(t)
    setTasks([])
    if (t.contato_id) {
      startTasks(async () => {
        const res = await getTripTasks(orgSlug, t.contato_id!)
        setTasks(res)
      })
    }
  }

  const counts = useMemo(() => {
    const c = { all: trips.length, upcoming: 0, ongoing: 0, past: 0 }
    for (const t of trips) c[tripState(t, today)]++
    return c
  }, [trips, today])

  if (trips.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="Nenhum embarque programado"
        description="As viagens vendidas com data de partida aparecem aqui em um painel visual. Registre uma reserva em Reservas para começar."
      >
        <Button className="mt-4" asChild>
          <Link href={`/app/${orgSlug}/reservas`}>Ir para Reservas</Link>
        </Button>
      </EmptyState>
    )
  }

  return (
    <>
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        {([
          { id: 'all', label: `Todas (${counts.all})` },
          { id: 'upcoming', label: `Próximas (${counts.upcoming})` },
          { id: 'ongoing', label: `Em andamento (${counts.ongoing})` },
          { id: 'past', label: `Concluídas (${counts.past})` },
        ] as const).map(b => (
          <button
            key={b.id}
            onClick={() => setFilter(b.id)}
            className={cn(
              'px-3 h-8 rounded-full border text-xs font-medium transition-colors',
              filter === b.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted text-muted-foreground border-border',
            )}
          >
            {b.label}
          </button>
        ))}
      </div>

      <Tabs defaultValue="gantt">
        <TabsList>
          <TabsTrigger value="gantt"><CalendarDays className="w-4 h-4 mr-1.5" /> Linha do tempo</TabsTrigger>
          <TabsTrigger value="list"><ListChecks className="w-4 h-4 mr-1.5" /> Lista</TabsTrigger>
        </TabsList>

        {/* ── Gantt ───────────────────────────────────────────── */}
        <TabsContent value="gantt" className="mt-4">
          <div className="rounded-xl border bg-card overflow-hidden">
            {/* nav header */}
            <div className="flex items-center justify-between gap-2 p-3 border-b">
              <Button variant="outline" size="sm" onClick={() => setMonthOffset(o => o - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-medium">
                {months[0]?.label} — {months[2]?.label}
              </span>
              <div className="flex items-center gap-2">
                {monthOffset !== 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setMonthOffset(0)}>Hoje</Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setMonthOffset(o => o + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* month columns header */}
            <div className="relative h-7 border-b bg-muted/30">
              {months.map((m, i) => (
                <div key={i}
                  className="absolute top-0 h-full flex items-center justify-center text-[11px] font-medium text-muted-foreground border-l first:border-l-0"
                  style={{ left: `${m.leftPct}%`, width: `${m.widthPct}%` }}>
                  {m.label}
                </div>
              ))}
            </div>

            {/* rows */}
            <div className="relative max-h-[60vh] overflow-y-auto">
              {/* today line */}
              {todayPct !== null && (
                <div className="absolute top-0 bottom-0 w-px bg-rose-500/70 z-10 pointer-events-none"
                  style={{ left: `${todayPct}%` }}>
                  <span className="absolute -top-0 -translate-x-1/2 text-[9px] text-rose-600 bg-card px-1">hoje</span>
                </div>
              )}
              {ganttTrips.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Nenhuma viagem nesse período. Use as setas para navegar.
                </div>
              ) : ganttTrips.map(({ trip, left, width, state }) => {
                const meta = STATE_META[state]
                return (
                  <div key={trip.id} className="relative h-12 border-b last:border-b-0">
                    <button
                      type="button"
                      onClick={() => openTrip(trip)}
                      title={`${trip.client_name || trip.lead_name || 'Viagem'} — ${trip.destination || ''}`}
                      className={cn(
                        'absolute top-1/2 -translate-y-1/2 h-7 rounded-md px-2 flex items-center text-[11px] font-medium text-white shadow-sm hover:brightness-95 transition-all overflow-hidden',
                        meta.bar,
                      )}
                      style={{ left: `${left}%`, width: `${width}%`, minWidth: 60 }}
                    >
                      <span className="truncate">
                        {trip.client_name || trip.lead_name || 'Viagem'}
                        {trip.destination ? ` · ${trip.destination}` : ''}
                      </span>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* legenda */}
          <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-muted-foreground">
            {(['upcoming', 'ongoing', 'past'] as TripState[]).map(s => (
              <span key={s} className="flex items-center gap-1.5">
                <span className={cn('w-3 h-3 rounded-sm', STATE_META[s].bar)} /> {STATE_META[s].label}
              </span>
            ))}
          </div>
        </TabsContent>

        {/* ── Lista ───────────────────────────────────────────── */}
        <TabsContent value="list" className="mt-4">
          <div className="rounded-xl border bg-card divide-y">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma viagem com esse filtro.</div>
            ) : filtered.map(t => {
              const state = tripState(t, today)
              const meta = STATE_META[state]
              return (
                <button key={t.id} type="button" onClick={() => openTrip(t)}
                  className="w-full text-left p-4 hover:bg-muted/40 transition-colors flex items-center gap-4">
                  <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', meta.dot)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{t.client_name || t.lead_name || 'Viagem'}</span>
                      <Badge variant="outline" className={cn('shrink-0 text-[10px]', meta.badge)}>{meta.label}</Badge>
                    </div>
                    {t.destination && (
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3" /> <span className="truncate">{t.destination}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-medium flex items-center gap-1.5 justify-end">
                      <CalendarDays className="w-3 h-3 text-muted-foreground" />
                      {fmtDate(t.departure_date)} – {fmtDate(t.return_date)}
                    </div>
                    <div className="text-xs text-muted-foreground tabular-nums mt-0.5">{formatCurrency(t.total_cents || 0)}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Detalhe ──────────────────────────────────────────── */}
      <Dialog open={!!selected} onOpenChange={o => !o && setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {selected && (
            <TripDetail
              orgSlug={orgSlug}
              trip={selected}
              tasks={tasks}
              loadingTasks={loadingTasks}
              state={tripState(selected, today)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function TripDetail({
  orgSlug, trip, tasks, loadingTasks, state,
}: {
  orgSlug: string
  trip: ScheduledTrip
  tasks: TripTask[]
  loadingTasks: boolean
  state: TripState
}) {
  const meta = STATE_META[state]
  const wa = whatsappLink(trip.lead_phone)
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 pr-6">
          <span className="truncate">{trip.client_name || trip.lead_name || 'Viagem'}</span>
          <Badge variant="outline" className={cn('shrink-0 text-[10px]', meta.badge)}>{meta.label}</Badge>
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        {/* período */}
        <div className="rounded-lg border bg-muted/30 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <CalendarDays className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">{fmtDate(trip.departure_date)}</span>
            <span className="text-muted-foreground">→</span>
            <span className="font-medium">{fmtDate(trip.return_date)}</span>
          </div>
          <span className="text-sm font-semibold tabular-nums">{formatCurrency(trip.total_cents || 0)}</span>
        </div>

        {/* infos */}
        <div className="grid grid-cols-2 gap-3 text-sm">
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
            <Link href={`/app/${orgSlug}/reservas`}>
              <ExternalLink className="w-4 h-4 mr-1.5" /> Abrir venda
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
