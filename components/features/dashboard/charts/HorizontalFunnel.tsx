import { ChevronDown } from 'lucide-react'
import { fmtCurrencyCompact, fmtPct } from '@/lib/dashboard/format'
import { carbonColor } from '@/lib/charts/carbon-theme'

export type FunnelStep = {
  name: string
  count: number
  value_cents?: number
  /** % que avançou para o próximo estágio. */
  conv_next_pct: number | null
  /** % acumulada deste estágio até a venda. */
  to_won_pct?: number | null
  color?: string | null
}

/**
 * Funil horizontal (step funnel): uma barra por estágio, largura
 * proporcional à quantidade, centralizada — com a conversão para o próximo
 * estágio entre as barras. `detailed` mostra valor financeiro e taxa
 * acumulada até a venda (aba Pipeline). HTML/CSS puro.
 */
export default function HorizontalFunnel({ steps, detailed = false }: { steps: FunnelStep[]; detailed?: boolean }) {
  const max = Math.max(1, ...steps.map(s => s.count))
  return (
    <div className="space-y-0.5">
      {steps.map((s, i) => {
        const w = Math.max(6, (s.count / max) * 100)
        const color = s.color || carbonColor(0)
        return (
          <div key={`${s.name}-${i}`}>
            <div className="grid grid-cols-[minmax(84px,120px)_1fr_auto] items-center gap-3 group">
              <span className="text-xs font-medium truncate" title={s.name}>{s.name}</span>
              <div className="relative h-8 flex justify-center">
                <div
                  className="h-full rounded-md flex items-center justify-center text-[11px] font-semibold text-white tabular-nums transition-[filter] group-hover:brightness-110"
                  style={{ width: `${w}%`, backgroundColor: color, opacity: 0.35 + 0.65 * (1 - i / Math.max(1, steps.length)) }}
                  title={`${s.name}: ${s.count}${s.value_cents !== undefined ? ` · ${fmtCurrencyCompact(s.value_cents)}` : ''}`}
                >
                  {w > 14 ? s.count : ''}
                </div>
              </div>
              <div className="text-right text-xs tabular-nums w-[92px]">
                <div className="font-semibold">{s.count}{detailed && s.value_cents !== undefined && <span className="text-muted-foreground font-normal"> · {fmtCurrencyCompact(s.value_cents)}</span>}</div>
                {detailed && s.to_won_pct !== undefined && s.to_won_pct !== null && i < steps.length - 1 && (
                  <div className="text-[10px] text-muted-foreground">{fmtPct(s.to_won_pct)} até venda</div>
                )}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div className="grid grid-cols-[minmax(84px,120px)_1fr_auto] gap-3">
                <span />
                <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground h-4">
                  <ChevronDown className="w-3 h-3" />
                  <span className="tabular-nums font-medium text-foreground/80">{fmtPct(s.conv_next_pct)}</span>
                </div>
                <span className="w-[92px]" />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
