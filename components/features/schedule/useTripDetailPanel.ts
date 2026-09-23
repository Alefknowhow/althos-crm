'use client'

/**
 * Estado do painel de detalhe (Sheet sobreposto) de uma viagem — compartilhado
 * entre a Lista (ScheduleClient) e a Linha do tempo (ScheduleTimelineClient),
 * já que as duas abrem o mesmo painel ao clicar numa viagem. Extraído de
 * ScheduleClient.tsx pra não duplicar essa lógica entre as duas rotas.
 */

import { useTransition, useState, type Dispatch, type SetStateAction } from 'react'
import type { ScheduledTrip } from '@/actions/travel-schedule'
import {
  getTripDetailExtra, type TripTraveler, type TripVoucher,
} from '@/actions/travel-schedule-detail'
import { listSaleProducts, type SaleProduct } from '@/actions/sale-products'
import { listTasksForSale, type SaleTaskRow } from '@/actions/tasks-crud'

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

export function useTripDetailPanel(orgSlug: string, setTripsState: Dispatch<SetStateAction<ScheduledTrip[]>>) {
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
   *  linha/barra correspondente da lista/timeline, sem esperar reload da
   *  página. */
  function handleTasksChange(next: SaleTaskRow[]) {
    setTasks(next)
    if (!selected) return
    const summary = summarizeTasks(next)
    setSelected(prev => (prev ? { ...prev, ...summary } : prev))
    setTripsState(prev => prev.map(t => (t.id === selected.id ? { ...t, ...summary } : t)))
  }

  return {
    selected, detailOpen, detailTab, tasks, loadingTasks, products, loadingProducts,
    travelers, vouchers, loadingExtra, openTrip, handleTasksChange,
    onOpenChange: (o: boolean) => { setDetailOpen(o); if (!o) setSelected(null) },
  }
}
