'use client'

import { useState } from 'react'
import { MobileKpiCard } from './MobileKpiCard'
import { MobileButton } from './MobileButton'

export type MobileKpiItem = { label: string; value: string; comparisonLabel?: string; trend?: 'up' | 'down' | 'neutral' }

/**
 * Grade 2×2 de KPIs mobile (spec mobile M01/5.1) — mostra `priorityCount`
 * primeiro, com "Todos os indicadores" revelando o resto. Substitui a
 * grade de 6 colunas apertada em 2 colunas no mobile.
 */
export function MobileKpiGrid({ items, priorityCount = 4 }: { items: MobileKpiItem[]; priorityCount?: number }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? items : items.slice(0, priorityCount)
  const hasMore = items.length > priorityCount

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3">
        {visible.map(item => (
          <MobileKpiCard key={item.label} label={item.label} value={item.value} comparisonLabel={item.comparisonLabel} trend={item.trend} />
        ))}
      </div>
      {hasMore && (
        <MobileButton variant="text" onClick={() => setExpanded(v => !v)} className="w-full">
          {expanded ? 'Ver menos' : 'Todos os indicadores'}
        </MobileButton>
      )}
    </div>
  )
}
