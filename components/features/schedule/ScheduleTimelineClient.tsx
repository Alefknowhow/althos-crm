'use client'

/**
 * Linha do tempo (Gantt) de Embarques — rota irmã da Lista
 * (/embarques/linha-do-tempo), acessada pelo submenu expansível "Embarques"
 * na sidebar em vez de uma aba dentro da página de lista. Reaproveita
 * ScheduleGanttView (nunca removido) e o mesmo painel de detalhe/filtros da
 * Lista.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import EmptyState from '@/components/ui/empty-state'
import type { ScheduledTrip } from '@/actions/travel-schedule'
import { CalendarDays } from 'lucide-react'
import { TripDetail } from './ScheduleTripDetail'
import { ScheduleGanttView, type TripState } from './ScheduleGanttView'
import { ScheduleFiltersBar } from './ScheduleFiltersBar'
import { useScheduleFilters } from './useScheduleFilters'
import { useTripDetailPanel } from './useTripDetailPanel'
import { tripState as tripStateOf } from './schedule-phase'

const DAY = 86400000
const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const TODAY_COLUMN = 4
const NAV_STEP_DAYS = 30

function parseDate(s?: string | null): Date | null {
  if (!s) return null
  const d = new Date(s + 'T12:00:00')
  return isNaN(d.getTime()) ? null : d
}
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
function addMonths(d: Date, n: number) { const x = new Date(d); x.setMonth(x.getMonth() + n); return x }
function addDays(d: Date, n: number) { return new Date(d.getTime() + n * DAY) }
function firstOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1) }

export default function ScheduleTimelineClient({
  orgSlug, trips, members = [],
}: {
  orgSlug: string
  trips: ScheduledTrip[]
  members?: { user_id: string; name: string }[]
}) {
  const today = useMemo(() => startOfDay(new Date()), [])
  const [tripsState, setTripsState] = useState(trips)
  useEffect(() => { setTripsState(trips) }, [trips])
  const f = useScheduleFilters(tripsState, today)
  const panel = useTripDetailPanel(orgSlug, setTripsState)

  const destinations = useMemo(
    () => Array.from(new Set(tripsState.map(t => t.destination).filter(Boolean))).sort() as string[],
    [tripsState],
  )
  const operators = useMemo(
    () => Array.from(new Set(tripsState.map(t => t.operator).filter(Boolean))).sort() as string[],
    [tripsState],
  )
  const quickCounts = useMemo(() => {
    const c = { all: tripsState.length, week: 0, month: 0, pending: 0 }
    const dow = today.getDay()
    const weekStart = new Date(today.getTime() + (dow === 0 ? -6 : 1 - dow) * DAY)
    const weekEnd = new Date(weekStart.getTime() + 6 * DAY)
    for (const t of tripsState) {
      const dep = parseDate(t.departure_date)
      if (dep) {
        if (dep >= weekStart && dep <= weekEnd) c.week++
        if (dep.getFullYear() === today.getFullYear() && dep.getMonth() === today.getMonth()) c.month++
      }
      if (t.tasks_total - t.tasks_done > 0) c.pending++
    }
    return c
  }, [tripsState, today])

  const [dayOffset, setDayOffset] = useState(0)
  const [monthsSpan, setMonthsSpan] = useState(1)
  const ganttRef = useRef<HTMLDivElement>(null)

  // Ctrl+scroll no gráfico aproxima/afasta a janela de meses visível.
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
      return { trip: t, left, width, state: tripStateOf(t, today) }
    }).filter(Boolean) as { trip: ScheduledTrip; left: number; width: number; state: TripState }[]
  }, [f.filtered, windowStart, windowEnd, totalDays, today])

  const selectedTrip = panel.selected

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
      <ScheduleFiltersBar
        search={f.search} setSearch={f.setSearch}
        owner={f.owner} setOwner={f.setOwner} members={members}
        period={f.period} setPeriod={f.setPeriod}
        health={f.health} setHealth={f.setHealth}
        destination={f.destination} setDestination={f.setDestination} destinations={destinations}
        status={f.statusFilter} setStatus={f.setStatusFilter}
        operator={f.operator} setOperator={f.setOperator} operators={operators}
        sort={f.sort} setSort={f.setSort}
        quickView={f.quickView} setQuickView={f.setQuickView} quickCounts={quickCounts}
      />

      <div className="mt-3">
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
          onOpenTrip={panel.openTrip}
        />
      </div>

      <TripDetail
        orgSlug={orgSlug}
        trip={selectedTrip}
        tasks={panel.tasks}
        loadingTasks={panel.loadingTasks}
        onTasksChange={panel.handleTasksChange}
        products={panel.products}
        loadingProducts={panel.loadingProducts}
        travelers={panel.travelers}
        vouchers={panel.vouchers}
        loadingExtra={panel.loadingExtra}
        state={selectedTrip ? tripStateOf(selectedTrip, today) : 'upcoming'}
        today={today}
        sellerName={selectedTrip ? members.find(m => m.user_id === selectedTrip.created_by)?.name : undefined}
        open={panel.detailOpen}
        onOpenChange={panel.onOpenChange}
        defaultTab={panel.detailTab}
      />
    </>
  )
}
