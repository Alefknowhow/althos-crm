'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import EmptyState from '@/components/ui/empty-state'
import type { ScheduledTrip } from '@/actions/travel-schedule'
import { CalendarDays } from 'lucide-react'
import { TripDetail } from './ScheduleTripDetail'
import { ScheduleListView } from './ScheduleListView'
import { ScheduleFiltersBar } from './ScheduleFiltersBar'
import { useScheduleFilters } from './useScheduleFilters'
import { useTripDetailPanel } from './useTripDetailPanel'
import { tripState as tripStateOf } from './schedule-phase'

function parseDate(s?: string | null): Date | null {
  if (!s) return null
  const d = new Date(s + 'T12:00:00')
  return isNaN(d.getTime()) ? null : d
}
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }

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
    const weekStart = new Date(today.getTime() + (dow === 0 ? -6 : 1 - dow) * 86400000)
    const weekEnd = new Date(weekStart.getTime() + 6 * 86400000)
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
      {/* Busca e filtros → indicadores → tabela → contagem/paginação (issue
          #9 § 1) — a página começa direto na busca. */}
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
        <ScheduleListView
          orgSlug={orgSlug}
          filtered={f.filtered}
          today={today}
          onOpenTrip={(t, tab) => panel.openTrip(t, tab === 'tarefas' ? 'tarefas' : 'produtos')}
          page={f.page}
          setPage={f.setPage}
        />
      </div>

      {/* ── Detalhe (painel sobreposto, não desloca a lista) ────────── */}
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
