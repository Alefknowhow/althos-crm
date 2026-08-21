'use client'

import { useMemo, useState } from 'react'
import SellerChipFilter, { type Seller } from './SellerChipFilter'
import MonthlyRevenueCard from './MonthlyRevenueCard'
import SellerBarChartWithTable, { type SellerComparisonDisplayRow } from './SellerBarChartWithTable'
import type { ComboBarLinePoint } from './ComboBarLineChartInner'
import type { MonthlySalesRow, SellerComparisonRow } from '@/actions/dashboard-tabs'

function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, (m || 1) - 1, 1)
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(d).replace('.', '')
  const capitalized = label.charAt(0).toUpperCase() + label.slice(1)
  return `${capitalized}/${String(y).slice(2)}`
}

function lastNMonths(n: number): string[] {
  const out: string[] = []
  const d = new Date()
  d.setDate(1)
  for (let i = n - 1; i >= 0; i--) {
    const dd = new Date(d.getFullYear(), d.getMonth() - i, 1)
    out.push(`${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

export default function EquipeTeamSection({
  monthlyRows, comparisonRows, sellers, hasCommission, monthsBack = 6,
}: {
  monthlyRows: MonthlySalesRow[]
  comparisonRows: SellerComparisonRow[]
  sellers: Seller[]
  hasCommission: boolean
  monthsBack?: number
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(sellers.map(s => s.id)))
  const nameById = useMemo(() => new Map(sellers.map(s => [s.id, s.name])), [sellers])

  const monthlyPoints = useMemo<ComboBarLinePoint[]>(() => {
    const months = lastNMonths(monthsBack)
    const bucket = new Map<string, { revenue: number; commission: number; count: number }>()
    for (const r of monthlyRows) {
      if (r.seller_id && !selected.has(r.seller_id)) continue
      if (!r.seller_id && selected.size < sellers.length) continue // sem vendedor: só entra quando "Todos" está selecionado
      const cur = bucket.get(r.month) || { revenue: 0, commission: 0, count: 0 }
      cur.revenue += r.revenue_cents
      cur.commission += r.commission_cents || 0
      cur.count += r.sales_count
      bucket.set(r.month, cur)
    }
    return months.map(month => {
      const v = bucket.get(month) || { revenue: 0, commission: 0, count: 0 }
      return {
        label: monthLabel(month),
        revenue_cents: v.revenue,
        commission_cents: hasCommission ? v.commission : null,
        sales_count: v.count,
      }
    })
  }, [monthlyRows, selected, sellers.length, monthsBack, hasCommission])

  const comparisonDisplayRows = useMemo<SellerComparisonDisplayRow[]>(() => {
    return comparisonRows
      .filter(r => r.seller_id && selected.has(r.seller_id))
      .map(r => ({
        seller_id: r.seller_id,
        name: (r.seller_id && nameById.get(r.seller_id)) || 'Usuário removido',
        sales_count: r.sales_count,
        revenue_cents: r.revenue_cents,
        commission_cents: r.commission_cents,
        avg_ticket_cents: r.avg_ticket_cents,
      }))
      .sort((a, b) => b.revenue_cents - a.revenue_cents)
  }, [comparisonRows, selected, nameById])

  return (
    <div className="space-y-3">
      <SellerChipFilter sellers={sellers} selected={selected} onChange={setSelected} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <MonthlyRevenueCard rows={monthlyPoints} hasCommission={hasCommission} />
        <SellerBarChartWithTable rows={comparisonDisplayRows} hasCommission={hasCommission} />
      </div>
    </div>
  )
}
