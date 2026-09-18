'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import EmptyState from '@/components/ui/empty-state'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import type { ScheduledTrip } from '@/actions/travel-schedule'
import {
  getTripDetailExtra, type TripTraveler, type TripVoucher,
} from '@/actions/travel-schedule-detail'
import { listSaleProducts, type SaleProduct } from '@/actions/sale-products'
import { listTasksForSale, type SaleTaskRow } from '@/actions/tasks-crud'
import { ListChecks, CalendarDays } from 'lucide-react'
import { ScheduleGanttView, type TripState } from './ScheduleGanttView'
import { TripDetail } from './ScheduleTripDetail'
import { ScheduleListView } from './ScheduleListView'
import { ScheduleHeader } from './ScheduleHeader'
import { ScheduleStatusTabs } from './ScheduleStatusTabs'
import { tripState, tripPhase, hasAlert } from './schedule-phase'
import { ScheduleFiltersBar } from './ScheduleFiltersBar'
import { useScheduleFilters } from './useScheduleFilters'

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
const TODAY_COLUMN = 4
const NAV_STEP_DAYS = 30

/** Recalcula tasks_done/tasks_total/health de uma viagem a partir da lista
 *  de tarefas atual — mesma regra de saúde usada no servidor
 *  (listScheduledTrips): aberta com prioridade alta pesa mais que só aberta. */
function summarizeTasks(tasks: SaleTaskRow[]) {
  const openTasks = tasks.filter(t => t.status !== 'done')
  const health: ScheduledTrip['health'] = openTasks.length === 0
    ? 'green'
    : openTasks.some(t => t.priority === 'high') ? 'red' : 'yellow'
  return { tasks_done: tasks.length - openTasks.length, tasks_total: tasks.length, health }
}

export default function ScheduleClient({
  orgSlug, trips, members = [],
}: {
  orgSlug: string
  trips: ScheduledTrip[]
  members?: { user_id: string; name: string }[]
}) {
  const today = useMemo(() => startOfDay(new Date()), [])
  // Cópia local — precisa ser mutável pra refletir na hora as mudanças de
  // tarefa feitas no painel de detalhe (tasks_done/tasks_total/health), sem
  // esperar um refetch do servidor. Ressincroniza se o server mandar uma
  // lista nova (navegação/revalidação).
  const [tripsState, setTripsState] = useState(trips)
  useEffect(() => { setTripsState(trips) }, [trips])
  const f = useScheduleFilters(tripsState, today)
  const [dayOffset, setDayOffset] = useState(0)
  const [selected, setSelected] = useState<ScheduledTrip | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [tasks, setTasks] = useState<SaleTaskRow[]>([])
  const [loadingTasks, startTasks] = useTransition()
  const [products, setProducts] = useState<SaleProduct[]>([])
  const [loadingProducts, startProducts] = useTransition()
  const [travelers, setTravelers] = useState<TripTraveler[]>([])
  const [vouchers, setVouchers] = useState<TripVoucher[]>([])
  const [loadingExtra, startExtra] = useTransition()
  const [monthsSpan, setMonthsSpan] = useState(1)
  const ganttRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ganttRef.current
    if (!el) return
    function onWheel(e: WheelEvent) {
      if (!e.ctrlKey) return
      e.preventDefault()
      setMonthsSpan(v => Math.min(6, Math.max(1, v + (e.deltaY < 0 ? -1 : 1))))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const destinations = useMemo(
    () => Array.from(new Set(tripsState.map(t => t.destination).filter(Boolean))).sort() as string[],
    [tripsState],
  )
  const operators = useMemo(
    () => Array.from(new Set(tripsState.map(t => t.operator).filter(Boolean))).sort() as string[],
    [tripsState],
  )

  const totalDays = Math.max(1, monthsSpan * 30)
  const windowStart = useMemo(() => addDays(startOfDay(today), dayOffset - TODAY_COLUMN), [today, dayOffset])
  const windowEnd = useMemo(() => addDays(windowStart, totalDays), [windowStart, totalDays])

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

  const dayLines = useMemo(() => {
    const lines: number[] = []
    for (let i = 1; i < totalDays; i++) lines.push((i / totalDays) * 100)
    return lines
  }, [totalDays])

  const dayNumbers = useMemo(() => {
    const out: { day: number; leftPct: number }[] = []
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(windowStart.getTime() + i * DAY)
      out.push({ day: d.getDate(), leftPct: (i / totalDays) * 100 })
    }
    return out
  }, [windowStart, totalDays])

  const ganttTrips = useMemo(() => {
    return f.filtered.map(t => {
      const depRaw = parseDate(t.departure_date)
      const retRaw = parseDate(t.return_date) || depRaw
      if (!depRaw) return null
      const dep = startOfDay(depRaw)
      const end = startOfDay(retRaw || depRaw)
      if (end < windowStart || dep >= windowEnd) return null
      const clampedStart = Math.max(dep.getTime(), windowStart.getTime())
      const clampedEnd = Math.min(end.getTime() + DAY, windowEnd.getTime())
      const left = (clampedStart - windowStart.getTime()) / DAY / totalDays * 100
      const width = Math.max(1.5, (clampedEnd - clampedStart) / DAY / totalDays * 100)
      return { trip: t, left, width, state: tripState(t, today) }
    }).filter(Boolean) as { trip: ScheduledTrip; left: number; width: number; state: TripState }[]
  }, [f.filtered, windowStart, windowEnd, totalDays, today])

  function openTrip(t: ScheduledTrip) {
    setSelected(t)
    setDetailOpen(true)
    setTasks([])
    setProducts([])
    setTravelers([])
    setVouchers([])
    startTasks(async () => {
      const res = await listTasksForSale(orgSlug, t.id)
      setTasks(res)
    })
    startProducts(async () => {
      const res = await listSaleProducts(orgSlug, t.id)
      setProducts(res)
    })
    startExtra(async () => {
      const res = await getTripDetailExtra(orgSlug, t.id)
      setTravelers(res?.travelers ?? [])
      setVouchers(res?.vouchers ?? [])
    })
  }

  /** Sincroniza a mudança de tarefas (marcar concluída/excluir/criar, feito
   *  direto no painel de detalhe) de volta pro card de progresso e pro
   *  alerta de "tarefa crítica" — tanto na viagem selecionada quanto na
   *  linha correspondente da lista, sem esperar reload da página. */
  function handleTasksChange(next: SaleTaskRow[]) {
    setTasks(next)
    if (!selected) return
    const summary = summarizeTasks(next)
    setSelected(prev => (prev ? { ...prev, ...summary } : prev))
    setTripsState(prev => prev.map(t => (t.id === selected.id ? { ...t, ...summary } : t)))
  }

  const counts = useMemo(() => {
    const c = { all: tripsState.length, pre: 0, em: 0, pos: 0, concluida: 0, cancelada: 0, alerts: 0 }
    for (const t of tripsState) {
      c[tripPhase(t, today)]++
      if (hasAlert(t)) c.alerts++
    }
    return c
  }, [tripsState, today])

  const headerStats = useMemo(() => {
    const embarking7d = tripsState.filter(t => {
      const dep = parseDate(t.departure_date)
      if (!dep) return false
      const days = Math.round((dep.getTime() - today.getTime()) / DAY)
      return days >= 0 && days <= 7
    }).length
    return { ativas: tripsState.length, embarking7d, emViagem: counts.em, alerts: counts.alerts }
  }, [tripsState, counts, today])

  if (tripsState.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
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
      <ScheduleHeader orgSlug={orgSlug} stats={headerStats} />

      <Tabs defaultValue="list" className="mt-4">
        <div className="mb-3">
          <ScheduleStatusTabs value={f.statusTab} onChange={f.setStatusTab} counts={counts} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <ScheduleFiltersBar
              search={f.search} setSearch={f.setSearch}
              owner={f.owner} setOwner={f.setOwner} members={members}
              period={f.period} setPeriod={f.setPeriod}
              health={f.health} setHealth={f.setHealth}
              destination={f.destination} setDestination={f.setDestination} destinations={destinations}
              status={f.statusFilter} setStatus={f.setStatusFilter}
              operator={f.operator} setOperator={f.setOperator} operators={operators}
              sort={f.sort} setSort={f.setSort}
            />
          </div>
          <TabsList className="shrink-0">
            <TabsTrigger value="list"><ListChecks className="w-4 h-4 mr-1.5" /> Lista</TabsTrigger>
            <TabsTrigger value="gantt"><CalendarDays className="w-4 h-4 mr-1.5" /> Linha do tempo</TabsTrigger>
          </TabsList>
        </div>

        {/* ── Gantt ───────────────────────────────────────────── */}
        <TabsContent value="gantt" className="mt-4">
          <ScheduleGanttView
            ganttRef={ganttRef}
            months={months}
            dayNumbers={dayNumbers}
            dayLines={dayLines}
            todayPct={todayPct}
            totalDays={totalDays}
            ganttTrips={ganttTrips}
            dayOffset={dayOffset}
            setDayOffset={setDayOffset}
            navStepDays={NAV_STEP_DAYS}
            onOpenTrip={openTrip}
          />
        </TabsContent>

        {/* ── Lista ───────────────────────────────────────────── */}
        <TabsContent value="list" className="mt-0">
          <ScheduleListView orgSlug={orgSlug} filtered={f.filtered} today={today} onOpenTrip={openTrip} />
        </TabsContent>
      </Tabs>

      {/* ── Detalhe ──────────────────────────────────────────── */}
      <TripDetail
        orgSlug={orgSlug}
        trip={selected}
        tasks={tasks}
        loadingTasks={loadingTasks}
        onTasksChange={handleTasksChange}
        products={products}
        loadingProducts={loadingProducts}
        travelers={travelers}
        vouchers={vouchers}
        loadingExtra={loadingExtra}
        state={selected ? tripState(selected, today) : 'upcoming'}
        today={today}
        sellerName={selected ? members.find(m => m.user_id === selected.created_by)?.name : undefined}
        open={detailOpen}
        onOpenChange={o => { setDetailOpen(o); if (!o) setSelected(null) }}
      />
    </>
  )
}
