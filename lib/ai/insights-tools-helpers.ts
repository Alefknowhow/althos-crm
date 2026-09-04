/**
 * Shared period-window and formatting helpers for the AI Analyst tools
 * (insights-tools-*.ts). Split out of insights-tools.ts.
 */

export type Period = '7d' | '30d' | '90d' | 'mtd' | 'qtd' | 'ytd'

export function periodWindow(period: Period | string | undefined): {
  start: Date
  prevStart: Date
  prevEnd: Date
  label: string
} {
  const now = new Date()
  const start = new Date()
  const prevStart = new Date()
  const prevEnd = new Date()
  switch ((period as Period) || '30d') {
    case '7d':
      start.setDate(now.getDate() - 7)
      prevStart.setDate(now.getDate() - 14)
      prevEnd.setDate(now.getDate() - 7)
      return { start, prevStart, prevEnd, label: 'últimos 7 dias' }
    case '90d':
      start.setDate(now.getDate() - 90)
      prevStart.setDate(now.getDate() - 180)
      prevEnd.setDate(now.getDate() - 90)
      return { start, prevStart, prevEnd, label: 'últimos 90 dias' }
    case 'mtd': {
      start.setTime(new Date(now.getFullYear(), now.getMonth(), 1).getTime())
      // Same span in previous month for comparison.
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const daysIn = (now.getTime() - start.getTime()) / 86_400_000
      prevStart.setTime(prevMonthStart.getTime())
      prevEnd.setTime(prevMonthStart.getTime() + daysIn * 86_400_000)
      return { start, prevStart, prevEnd, label: 'mês atual' }
    }
    case 'qtd': {
      const q = Math.floor(now.getMonth() / 3)
      start.setTime(new Date(now.getFullYear(), q * 3, 1).getTime())
      prevStart.setTime(new Date(now.getFullYear(), q * 3 - 3, 1).getTime())
      prevEnd.setTime(start.getTime())
      return { start, prevStart, prevEnd, label: 'trimestre atual' }
    }
    case 'ytd': {
      start.setTime(new Date(now.getFullYear(), 0, 1).getTime())
      prevStart.setTime(new Date(now.getFullYear() - 1, 0, 1).getTime())
      prevEnd.setTime(new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).getTime())
      return { start, prevStart, prevEnd, label: 'ano atual' }
    }
    case '30d':
    default:
      start.setDate(now.getDate() - 30)
      prevStart.setDate(now.getDate() - 60)
      prevEnd.setDate(now.getDate() - 30)
      return { start, prevStart, prevEnd, label: 'últimos 30 dias' }
  }
}

export function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    (cents || 0) / 100,
  )
}

export function pctChange(current: number, previous: number): number {
  if (!previous) return 0
  return ((current - previous) / previous) * 100
}
