'use client'

/**
 * Filtros/ordenação da lista de embarques — extraído de ScheduleClient.tsx
 * (que passou do limite de linhas do projeto) só pra isolar esse estado.
 */

import { useEffect, useMemo, useState } from 'react'
import type { ScheduledTrip } from '@/actions/travel-schedule'
import {
  type SchedulePeriod, type ScheduleHealthFilter, type ScheduleStatusFilter, type ScheduleSort,
} from './ScheduleFiltersBar'
import { daysFromToday } from './schedule-phase'

const DAY = 86400000

/** Seleção do painel de indicadores (Todas/Essa semana/Esse mês/Pendências)
 *  — combinável com os demais filtros (busca, Período, Responsável...), o
 *  mesmo padrão de "tudo se combina" que os atalhos antigos já tinham. */
export type ScheduleQuickView = 'all' | 'week' | 'month' | 'pending'

function parseDate(s?: string | null): Date | null {
  if (!s) return null
  const d = new Date(s + 'T12:00:00')
  return isNaN(d.getTime()) ? null : d
}
function addMonths(d: Date, n: number) { const x = new Date(d); x.setMonth(x.getMonth() + n); return x }
function addDays(d: Date, n: number) { return new Date(d.getTime() + n * DAY) }

/** Início (segunda) e fim (domingo) da semana corrente de `today`. */
function currentWeekRange(today: Date): { start: Date; end: Date } {
  const dow = today.getDay() // 0 = domingo
  const mondayOffset = dow === 0 ? -6 : 1 - dow
  const start = addDays(today, mondayOffset)
  const end = addDays(start, 6)
  return { start, end }
}

export function useScheduleFilters(trips: ScheduledTrip[], today: Date) {
  const [quickView, setQuickView] = useState<ScheduleQuickView>('all')
  const [owner, setOwner] = useState('all')
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState<SchedulePeriod>('all')
  const [health, setHealth] = useState<ScheduleHealthFilter>('all')
  const [destination, setDestination] = useState('all')
  const [statusFilter, setStatusFilter] = useState<ScheduleStatusFilter>('all')
  const [operator, setOperator] = useState('all')
  const [sort, setSort] = useState<ScheduleSort>('departure')
  // Página da lista — só reseta quando um critério de filtro/busca/ordenação
  // muda de verdade, nunca quando `trips` é atualizado por uma mutação local
  // (ex.: marcar tarefa concluída no painel), pra não perder a posição do
  // usuário (issue #9 § 4: "preservar página e rolagem").
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    let out = trips
    if (quickView === 'pending') {
      out = out.filter(t => t.tasks_total - t.tasks_done > 0)
    } else if (quickView === 'week') {
      const { start, end } = currentWeekRange(today)
      out = out.filter(t => {
        const dep = parseDate(t.departure_date)
        return !!dep && dep >= start && dep <= end
      })
    } else if (quickView === 'month') {
      out = out.filter(t => {
        const dep = parseDate(t.departure_date)
        return !!dep && dep.getFullYear() === today.getFullYear() && dep.getMonth() === today.getMonth()
      })
    }
    if (owner !== 'all') out = out.filter(t => t.created_by === owner)
    if (health !== 'all') out = out.filter(t => t.health === health)
    if (destination !== 'all') out = out.filter(t => t.destination === destination)
    if (operator !== 'all') out = out.filter(t => t.operator === operator)
    if (statusFilter !== 'all') out = out.filter(t => (statusFilter === 'cancelled') === (t.status === 'cancelled'))
    if (period !== 'all') {
      out = out.filter(t => {
        const dep = parseDate(t.departure_date)
        if (!dep) return false
        if (period === 'today') return daysFromToday(dep, today) === 0
        if (period === 'next7') { const d = daysFromToday(dep, today); return d >= 0 && d <= 7 }
        if (period === '30d') return dep >= today && dep <= addDays(today, 30)
        const monthOffset = period === 'month' ? 0 : 1
        const target = addMonths(today, monthOffset)
        return dep.getFullYear() === target.getFullYear() && dep.getMonth() === target.getMonth()
      })
    }
    const needle = search.trim().toLowerCase()
    if (needle) {
      out = out.filter(t =>
        (t.client_name || '').toLowerCase().includes(needle) ||
        (t.destination || '').toLowerCase().includes(needle) ||
        (t.package_locator || '').toLowerCase().includes(needle) ||
        (t.air_locator || '').toLowerCase().includes(needle),
      )
    }
    const sorted = [...out]
    sorted.sort((a, b) => {
      switch (sort) {
        case 'return': return (parseDate(a.return_date)?.getTime() || 0) - (parseDate(b.return_date)?.getTime() || 0)
        case 'client': return (a.client_name || '').localeCompare(b.client_name || '')
        case 'destination': return (a.destination || '').localeCompare(b.destination || '')
        case 'tasks_pending': return (b.tasks_total - b.tasks_done) - (a.tasks_total - a.tasks_done)
        default: return (parseDate(a.departure_date)?.getTime() || 0) - (parseDate(b.departure_date)?.getTime() || 0)
      }
    })
    return sorted
  }, [trips, quickView, owner, health, destination, operator, statusFilter, period, search, sort, today])

  useEffect(() => { setPage(1) }, [quickView, owner, search, period, health, destination, statusFilter, operator, sort])

  return {
    quickView, setQuickView, owner, setOwner, search, setSearch, period, setPeriod,
    health, setHealth, destination, setDestination, statusFilter, setStatusFilter,
    operator, setOperator, sort, setSort, filtered, page, setPage,
  }
}
