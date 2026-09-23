'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import EmptyState from '@/components/ui/empty-state'
import type { ScheduledTrip } from '@/actions/travel-schedule'
import {
  getTripDetailExtra, type TripTraveler, type TripVoucher,
} from '@/actions/travel-schedule-detail'
import { listSaleProducts, type SaleProduct } from '@/actions/sale-products'
import { listTasksForSale, type SaleTaskRow } from '@/actions/tasks-crud'
import { CalendarDays } from 'lucide-react'
import { TripDetail } from './ScheduleTripDetail'
import { ScheduleListView } from './ScheduleListView'
import { ScheduleStatusTabs } from './ScheduleStatusTabs'
import { ScheduleFiltersBar } from './ScheduleFiltersBar'
import { useScheduleFilters } from './useScheduleFilters'
import { tripState as tripStateOf, daysFromToday } from './schedule-phase'

function parseDate(s?: string | null): Date | null {
  if (!s) return null
  const d = new Date(s + 'T12:00:00')
  return isNaN(d.getTime()) ? null : d
}
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }

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
  const [selected, setSelected] = useState<ScheduledTrip | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailTab, setDetailTab] = useState<'produtos' | 'tarefas'>('produtos')
  const [tasks, setTasks] = useState<SaleTaskRow[]>([])
  const [loadingTasks, startTasks] = useTransition()
  const [products, setProducts] = useState<SaleProduct[]>([])
  const [loadingProducts, startProducts] = useTransition()
  const [travelers, setTravelers] = useState<TripTraveler[]>([])
  const [vouchers, setVouchers] = useState<TripVoucher[]>([])
  const [loadingExtra, startExtra] = useTransition()

  const destinations = useMemo(
    () => Array.from(new Set(tripsState.map(t => t.destination).filter(Boolean))).sort() as string[],
    [tripsState],
  )
  const operators = useMemo(
    () => Array.from(new Set(tripsState.map(t => t.operator).filter(Boolean))).sort() as string[],
    [tripsState],
  )

  function openTrip(t: ScheduledTrip, tab: 'produtos' | 'tarefas' = 'produtos') {
    setSelected(t)
    setDetailTab(tab)
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
    const c = { all: tripsState.length, today: 0, next7: 0, pending: 0 }
    for (const t of tripsState) {
      const dep = parseDate(t.departure_date)
      if (dep) {
        const days = daysFromToday(dep, today)
        if (days === 0) c.today++
        if (days >= 0 && days <= 7) c.next7++
      }
      if (t.tasks_total - t.tasks_done > 0) c.pending++
    }
    return c
  }, [tripsState, today])

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
      {/* Busca e filtros → atalhos com contadores → tabela → contagem/
          paginação (issue #9 § 1) — a página começa direto na busca. */}
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

      <div className="mt-3 mb-3">
        <ScheduleStatusTabs value={f.statusTab} onChange={f.setStatusTab} counts={counts} />
      </div>

      <ScheduleListView
        orgSlug={orgSlug}
        filtered={f.filtered}
        today={today}
        onOpenTrip={(t, tab) => openTrip(t, tab === 'tarefas' ? 'tarefas' : 'produtos')}
        page={f.page}
        setPage={f.setPage}
      />

      {/* ── Detalhe (painel sobreposto, não desloca a lista) ────────── */}
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
        state={selected ? tripStateOf(selected, today) : 'upcoming'}
        today={today}
        sellerName={selected ? members.find(m => m.user_id === selected.created_by)?.name : undefined}
        open={detailOpen}
        onOpenChange={o => { setDetailOpen(o); if (!o) setSelected(null) }}
        defaultTab={detailTab}
      />
    </>
  )
}
