'use client'

/**
 * Filtros/ordenação da lista de embarques — extraído de ScheduleClient.tsx
 * (que passou do limite de linhas do projeto) só pra isolar esse estado.
 */

import { useMemo, useState } from 'react'
import type { ScheduledTrip } from '@/actions/travel-schedule'
import { tripPhase, hasAlert } from './schedule-phase'
import {
  type SchedulePeriod, type ScheduleHealthFilter, type ScheduleStatusFilter, type ScheduleSort,
} from './ScheduleFiltersBar'
import { type ScheduleStatusTab } from './ScheduleStatusTabs'

const DAY = 86400000

function parseDate(s?: string | null): Date | null {
  if (!s) return null
  const d = new Date(s + 'T12:00:00')
  return isNaN(d.getTime()) ? null : d
}
function addMonths(d: Date, n: number) { const x = new Date(d); x.setMonth(x.getMonth() + n); return x }
function addDays(d: Date, n: number) { return new Date(d.getTime() + n * DAY) }

export function useScheduleFilters(trips: ScheduledTrip[], today: Date) {
  const [statusTab, setStatusTab] = useState<ScheduleStatusTab>('all')
  const [owner, setOwner] = useState('all')
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState<SchedulePeriod>('all')
  const [health, setHealth] = useState<ScheduleHealthFilter>('all')
  const [destination, setDestination] = useState('all')
  const [statusFilter, setStatusFilter] = useState<ScheduleStatusFilter>('all')
  const [operator, setOperator] = useState('all')
  const [sort, setSort] = useState<ScheduleSort>('departure')

  const filtered = useMemo(() => {
    let out = trips
    if (statusTab === 'alerts') out = out.filter(hasAlert)
    else if (statusTab !== 'all') out = out.filter(t => tripPhase(t, today) === statusTab)
    if (owner !== 'all') out = out.filter(t => t.created_by === owner)
    if (health !== 'all') out = out.filter(t => t.health === health)
    if (destination !== 'all') out = out.filter(t => t.destination === destination)
    if (operator !== 'all') out = out.filter(t => t.operator === operator)
    if (statusFilter !== 'all') out = out.filter(t => (statusFilter === 'cancelled') === (t.status === 'cancelled'))
    if (period !== 'all') {
      out = out.filter(t => {
        const dep = parseDate(t.departure_date)
        if (!dep) return false
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
  }, [trips, statusTab, owner, health, destination, operator, statusFilter, period, search, sort, today])

  return {
    statusTab, setStatusTab, owner, setOwner, search, setSearch, period, setPeriod,
    health, setHealth, destination, setDestination, statusFilter, setStatusFilter,
    operator, setOperator, sort, setSort, filtered,
  }
}
