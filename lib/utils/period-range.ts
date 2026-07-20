// Period selector for financial dashboards — computes an absolute {from,to}
// date range (YYYY-MM-DD) for a named relative period.
// Pure client/server-safe helpers — no 'use server'/'use client' directive.

export type PeriodId =
  | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'last_year'

export const PERIOD_OPTIONS: { id: PeriodId; label: string }[] = [
  { id: 'this_week', label: 'Esta semana' },
  { id: 'last_week', label: 'Semana passada' },
  { id: 'this_month', label: 'Este mês' },
  { id: 'last_month', label: 'Mês passado' },
  { id: 'this_quarter', label: 'Este trimestre' },
  { id: 'this_year', label: 'Este ano' },
  { id: 'last_year', label: 'Ano passado' },
]

function toISO(d: Date): string {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0, 10)
}

export function periodToRange(id: PeriodId, now = new Date()): { from: string; to: string } {
  switch (id) {
    case 'this_week': {
      const start = new Date(now); start.setDate(now.getDate() - now.getDay())
      const end = new Date(start); end.setDate(start.getDate() + 6)
      return { from: toISO(start), to: toISO(end) }
    }
    case 'last_week': {
      const start = new Date(now); start.setDate(now.getDate() - now.getDay() - 7)
      const end = new Date(start); end.setDate(start.getDate() + 6)
      return { from: toISO(start), to: toISO(end) }
    }
    case 'this_month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return { from: toISO(start), to: toISO(end) }
    }
    case 'last_month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const end = new Date(now.getFullYear(), now.getMonth(), 0)
      return { from: toISO(start), to: toISO(end) }
    }
    case 'this_quarter': {
      const q = Math.floor(now.getMonth() / 3)
      const start = new Date(now.getFullYear(), q * 3, 1)
      const end = new Date(now.getFullYear(), q * 3 + 3, 0)
      return { from: toISO(start), to: toISO(end) }
    }
    case 'this_year': {
      return { from: toISO(new Date(now.getFullYear(), 0, 1)), to: toISO(new Date(now.getFullYear(), 11, 31)) }
    }
    case 'last_year': {
      return { from: toISO(new Date(now.getFullYear() - 1, 0, 1)), to: toISO(new Date(now.getFullYear() - 1, 11, 31)) }
    }
  }
}
