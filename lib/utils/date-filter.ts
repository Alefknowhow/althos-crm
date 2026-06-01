// Shared date-bucket filtering for list views (proposals, sales, etc.).
// Pure client/server-safe helpers — no 'use server'/'use client' directive.

export type DateBucket =
  | 'today' | 'this_week' | 'this_month' | 'next_month' | 'quarter' | 'year' | 'all'

export const DATE_BUCKETS: { id: DateBucket; label: string }[] = [
  { id: 'today',      label: 'Hoje' },
  { id: 'this_week',  label: 'Esta semana' },
  { id: 'this_month', label: 'Este mês' },
  { id: 'next_month', label: 'Próximo mês' },
  { id: 'quarter',    label: 'Trimestre' },
  { id: 'year',       label: 'Ano' },
  { id: 'all',        label: 'Todas' },
]

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Does the given ISO timestamp fall within the named calendar bucket? */
export function matchesDateBucket(iso: string | null | undefined, b: DateBucket): boolean {
  if (b === 'all') return true
  if (!iso) return false
  const d = new Date(iso)
  if (isNaN(d.getTime())) return false

  const now = new Date()
  const dd = startOfDay(d)
  const today = startOfDay(now)

  switch (b) {
    case 'today':
      return dd.getTime() === today.getTime()
    case 'this_week': {
      const ws = startOfDay(now); ws.setDate(now.getDate() - now.getDay())
      const we = new Date(ws); we.setDate(ws.getDate() + 6)
      return dd >= ws && dd <= we
    }
    case 'this_month':
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    case 'next_month': {
      const nm = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      return d.getFullYear() === nm.getFullYear() && d.getMonth() === nm.getMonth()
    }
    case 'quarter':
      return d.getFullYear() === now.getFullYear()
        && Math.floor(d.getMonth() / 3) === Math.floor(now.getMonth() / 3)
    case 'year':
      return d.getFullYear() === now.getFullYear()
    default:
      return true
  }
}
