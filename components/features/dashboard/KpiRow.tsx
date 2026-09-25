import KpiCard from './KpiCard'
import { MobileKpiGrid } from '@/components/features/mobile/MobileKpiGrid'

export type KpiItem = {
  label: string
  value: string
  help: string
  trend?: 'up' | 'down' | 'neutral'
  trendLabel?: string
  icon?: React.ReactNode
  progressPct?: number
  mock?: boolean
}

/**
 * Linha padrão de 6 KPIs do dashboard v2: 2x2 expansível no mobile
 * (MobileKpiGrid, spec M01), uma linha de 6 no desktop largo (xl), 3 por
 * linha em telas médias.
 */
export default function KpiRow({ items }: { items: KpiItem[] }) {
  return (
    <>
      <div className="sm:hidden">
        <MobileKpiGrid
          items={items.map(i => ({ label: i.label, value: i.value, comparisonLabel: i.trendLabel, trend: i.trend, progressPct: i.progressPct }))}
        />
      </div>
      <div className="hidden sm:grid grid-cols-3 xl:grid-cols-6 gap-3">
        {items.map(i => (
          <KpiCard key={i.label} {...i} />
        ))}
      </div>
    </>
  )
}
