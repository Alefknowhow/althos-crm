'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import EmptyState from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getTripTasks, type ScheduledTrip, type TripTask } from '@/actions/travel-schedule'
import { CalendarClock, CalendarDays, ListChecks } from 'lucide-react'
import { ScheduleGanttView, type TripState } from './ScheduleGanttView'
import { TripDetail } from './ScheduleTripDetail'
import { ScheduleListView } from './ScheduleListView'

const DAY = 86400000
const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function parseDate(s?: string | null): Date | null {
  if (!s) return null
  const d = new Date(s + 'T12:00:00')
  return isNaN(d.getTime()) ? null : d
}
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
function addMonths(d: Date, n: number) { const x = new Date(d); x.setMonth(x.getMonth() + n); return x }
function addDays(d: Date, n: number) { return new Date(d.getTime() + n * DAY) }
function firstOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1) }
// Coluna em que "hoje" deve ficar posicionado sempre que o módulo é aberto
// (não no início/borda da janela) — a navegação avança/retrocede o mesmo
// número de colunas (dias) por clique.
const TODAY_COLUMN = 4
const NAV_STEP_DAYS = 30

function tripState(t: ScheduledTrip, today: Date): TripState {
  const dep = parseDate(t.departure_date)
  const ret = parseDate(t.return_date) || dep
  if (!dep) return 'upcoming'
  const end = ret || dep
  if (end < today) return 'past'
  if (dep <= today && today <= end) return 'ongoing'
  return 'upcoming'
}

export default function ScheduleClient({
  orgSlug, trips, members = [],
}: {
  orgSlug: string
  trips: ScheduledTrip[]
  members?: { user_id: string; name: string }[]
}) {
  const today = useMemo(() => startOfDay(new Date()), [])
  const [filter, setFilter] = useState<'all' | TripState>('all')
  const [owner, setOwner] = useState<string>('all')
  // Deslocamento em dias a partir da posição padrão (hoje na coluna
  // TODAY_COLUMN) — navegação avança/retrocede NAV_STEP_DAYS colunas por vez.
  const [dayOffset, setDayOffset] = useState(0)
  const [selected, setSelected] = useState<ScheduledTrip | null>(null)
  const [tasks, setTasks] = useState<TripTask[]>([])
  const [loadingTasks, startTasks] = useTransition()
  // Zoom (Ctrl+scroll): quantos meses cabem na janela visível — menos meses
  // = colunas de dia mais largas (zoom in), mais meses = mais estreitas.
  // Padrão ao abrir a tela: 1 mês (28-31 colunas de dia, ~30) em vez dos
  // 3 meses anteriores — a janela é sempre alinhada a mês inteiro (ver
  // months/dayNumbers abaixo), por isso não dá pra travar em exatos 30 dias
  // sem também reformular os cabeçalhos de mês pra janelas parciais.
  const [monthsSpan, setMonthsSpan] = useState(1)
  const ganttRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ganttRef.current
    if (!el) return
    // preventDefault só funciona com um listener nativo não-passivo — o
    // onWheel do React é passivo por padrão, não bloquearia o zoom do
    // navegador (Ctrl+scroll também dá zoom na página inteira).
    function onWheel(e: WheelEvent) {
      if (!e.ctrlKey) return
      e.preventDefault()
      setMonthsSpan(v => Math.min(6, Math.max(1, v + (e.deltaY < 0 ? -1 : 1))))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const filtered = useMemo(() => {
    let out = trips
    if (filter !== 'all') out = out.filter(t => tripState(t, today) === filter)
    if (owner !== 'all') out = out.filter(t => t.created_by === owner)
    return out
  }, [trips, filter, owner, today])

  // Janela do gantt: ~monthsSpan meses (30 dias cada) a partir de uma
  // posição fixa em dias antes de hoje (TODAY_COLUMN), deslocada por
  // dayOffset (navegação em blocos de NAV_STEP_DAYS colunas).
  const totalDays = Math.max(1, monthsSpan * 30)
  const windowStart = useMemo(
    () => addDays(startOfDay(today), dayOffset - TODAY_COLUMN),
    [today, dayOffset],
  )
  const windowEnd = useMemo(() => addDays(windowStart, totalDays), [windowStart, totalDays])

  // Janela não é mais alinhada ao início do mês, então o cabeçalho de meses
  // precisa fatiar por mês-calendário sobreposto à janela, em vez de assumir
  // meses inteiros a partir de windowStart.
  const months = useMemo(() => {
    const out: { label: string; leftPct: number; widthPct: number }[] = []
    let cursor = firstOfMonth(windowStart)
    let guard = 0
    while (cursor.getTime() < windowEnd.getTime() && guard++ < 24) {
      const mStart = cursor
      const mEnd = addMonths(mStart, 1)
      const segStart = Math.max(mStart.getTime(), windowStart.getTime())
      const segEnd = Math.min(mEnd.getTime(), windowEnd.getTime())
      const left = (segStart - windowStart.getTime()) / DAY / totalDays * 100
      const width = (segEnd - segStart) / DAY / totalDays * 100
      out.push({ label: `${MONTHS_PT[mStart.getMonth()]} ${mStart.getFullYear()}`, leftPct: left, widthPct: width })
      cursor = mEnd
    }
    return out
  }, [windowStart, windowEnd, totalDays])

  const todayPct = useMemo(() => {
    const p = (today.getTime() - windowStart.getTime()) / DAY / totalDays * 100
    return p >= 0 && p <= 100 ? p : null
  }, [today, windowStart, totalDays])

  const dayWidthPct = 100 / totalDays

  // Linha vertical fina marcando o início de cada dia — só o próprio
  // limite (0%) e o fim (100%) ficam de fora, já cobertos pela borda do
  // container.
  const dayLines = useMemo(() => {
    const lines: number[] = []
    for (let i = 1; i < totalDays; i++) lines.push((i / totalDays) * 100)
    return lines
  }, [totalDays])

  // Número do dia, centralizado em cada coluna — linha bem discreta acima
  // das viagens, só pra orientar visualmente.
  const dayNumbers = useMemo(() => {
    const out: { day: number; leftPct: number }[] = []
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(windowStart.getTime() + i * DAY)
      out.push({ day: d.getDate(), leftPct: (i / totalDays) * 100 })
    }
    return out
  }, [windowStart, totalDays])

  // Trips que aparecem no gantt: que sobrepõem a janela
  const ganttTrips = useMemo(() => {
    return filtered.map(t => {
      const depRaw = parseDate(t.departure_date)
      const retRaw = parseDate(t.return_date) || depRaw
      if (!depRaw) return null
      // parseDate ancora em T12:00:00 (meio-dia) — windowStart/windowEnd são
      // meia-noite. Sem normalizar pra início do dia aqui, a marcação nasce
      // deslocada meio dia (metade de uma coluna) pra direita.
      const dep = startOfDay(depRaw)
      const end = startOfDay(retRaw || depRaw)
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
      <Tabs defaultValue="list">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <TabsList>
            <TabsTrigger value="gantt"><CalendarDays className="w-4 h-4 mr-1.5" /> Linha do tempo</TabsTrigger>
            <TabsTrigger value="list"><ListChecks className="w-4 h-4 mr-1.5" /> Lista</TabsTrigger>
          </TabsList>

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-1.5">
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

          {members.length > 0 && (
            <Select value={owner} onValueChange={setOwner}>
              <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue placeholder="Responsável" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos responsáveis</SelectItem>
                {members.map(m => (
                  <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* ── Gantt ───────────────────────────────────────────── */}
        <TabsContent value="gantt" className="mt-4">
          <ScheduleGanttView
            ganttRef={ganttRef}
            months={months}
            dayNumbers={dayNumbers}
            dayLines={dayLines}
            todayPct={todayPct}
            dayWidthPct={dayWidthPct}
            totalDays={totalDays}
            ganttTrips={ganttTrips}
            dayOffset={dayOffset}
            setDayOffset={setDayOffset}
            navStepDays={NAV_STEP_DAYS}
            onOpenTrip={openTrip}
          />
        </TabsContent>

        {/* ── Lista ───────────────────────────────────────────── */}
        <TabsContent value="list" className="mt-4">
          <ScheduleListView
            orgSlug={orgSlug}
            filtered={filtered}
            today={today}
            tripState={tripState}
            members={members}
            onOpenTrip={openTrip}
          />
        </TabsContent>
      </Tabs>

      {/* ── Detalhe ──────────────────────────────────────────── */}
      <Dialog open={!!selected} onOpenChange={o => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <TripDetail
              orgSlug={orgSlug}
              trip={selected}
              tasks={tasks}
              loadingTasks={loadingTasks}
              state={tripState(selected, today)}
              today={today}
              sellerName={members.find(m => m.user_id === selected.created_by)?.name}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
