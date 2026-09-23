import { CARBON_CHART_PALETTE } from '@/lib/charts/carbon-theme'

export interface LeadSourcesChartProps {
  data: { name: string; value: number }[]
}

/**
 * Barras horizontais retangulares (issue #26 §5) — substituiu o donut
 * anterior: nome à esquerda, quantidade + porcentagem sempre visíveis à
 * direita (nunca só no hover/tooltip), sem formato de pílula. O RPC de
 * origem (dashboard_lead_sources) já devolve todas as origens do período,
 * sem corte — a lista inteira aparece aqui, rolando dentro do card quando
 * não couber (nenhuma origem é escondida silenciosamente).
 */
export default function LeadSourcesChartInner({ data }: LeadSourcesChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0)

  if (data.length === 0 || total === 0) {
    return (
      <div className="h-full flex items-center justify-center text-center text-sm text-muted-foreground px-4">
        Nenhum lead com origem registrada neste período.
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto pr-1 space-y-3">
      {data.map((d, index) => {
        const pct = Math.round((d.value / total) * 100)
        const color = CARBON_CHART_PALETTE[index % CARBON_CHART_PALETTE.length]
        return (
          <div key={d.name} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-medium text-foreground truncate">{d.name}</span>
              <span className="tabular-nums text-muted-foreground shrink-0">
                {d.value} ({pct}%)
              </span>
            </div>
            <div className="h-2 rounded-sm bg-muted overflow-hidden">
              <div className="h-full rounded-sm" style={{ width: `${pct}%`, backgroundColor: color }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
