'use client'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { SlidersHorizontal } from 'lucide-react'
import { METRIC_REGISTRY, MAX_CARD_METRICS, type MetricKey } from './metricRegistry'

const ALL_KEYS = Object.keys(METRIC_REGISTRY) as MetricKey[]
const CHARTABLE_KEYS = ALL_KEYS.filter(k => METRIC_REGISTRY[k].chartable)

export default function MetricPicker({
  visibleCardMetrics,
  onChangeCardMetrics,
  visibleChartMetrics,
  onChangeChartMetrics,
}: {
  visibleCardMetrics: Set<MetricKey>
  onChangeCardMetrics: (next: Set<MetricKey>) => void
  visibleChartMetrics: Set<MetricKey>
  onChangeChartMetrics: (next: Set<MetricKey>) => void
}) {
  function toggleCard(k: MetricKey) {
    const next = new Set(visibleCardMetrics)
    if (next.has(k)) {
      if (next.size <= 1) return // sempre pelo menos 1 card visível
      next.delete(k)
    } else {
      if (next.size >= MAX_CARD_METRICS) return // cap de 8 pra não quebrar linha
      next.add(k)
    }
    onChangeCardMetrics(next)
  }

  function toggleChart(k: MetricKey) {
    const next = new Set(visibleChartMetrics)
    if (next.has(k)) {
      if (next.size <= 1) return
      next.delete(k)
    } else {
      next.add(k)
    }
    onChangeChartMetrics(next)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" /> Personalizar
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-h-[70vh] overflow-y-auto">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              Cards ({visibleCardMetrics.size}/{MAX_CARD_METRICS})
            </p>
            <div className="space-y-1.5">
              {ALL_KEYS.map(k => (
                <label key={k} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={visibleCardMetrics.has(k)}
                    onCheckedChange={() => toggleCard(k)}
                    disabled={!visibleCardMetrics.has(k) && visibleCardMetrics.size >= MAX_CARD_METRICS}
                  />
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: METRIC_REGISTRY[k].color }}
                  />
                  {METRIC_REGISTRY[k].label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Gráfico</p>
            <div className="space-y-1.5">
              {CHARTABLE_KEYS.map(k => (
                <label key={k} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={visibleChartMetrics.has(k)}
                    onCheckedChange={() => toggleChart(k)}
                  />
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: METRIC_REGISTRY[k].color }}
                  />
                  {METRIC_REGISTRY[k].label}
                </label>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
