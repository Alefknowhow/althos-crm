'use client'

import { useState, useMemo } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Filter, Loader2 } from 'lucide-react'
import { fetchStageThroughput, type FunnelPeriod, type StageThroughputRow } from '@/actions/funnel'
import { CHART_CARD_H } from './dashboardSizes'

type Props = {
  orgSlug: string
  pipelineId: string | null
}

const PERIOD_LABELS: Record<FunnelPeriod, string> = {
  '7d': '7 dias',
  '30d': '30 dias',
  '90d': '90 dias',
  mtd: 'Mês atual',
  qtd: 'Trimestre',
  ytd: 'Ano',
  all: 'Tudo',
}

/**
 * Funil histórico: quantos leads ENTRARAM em cada estágio durante o período
 * (um lead que passou por 3 estágios soma nos 3, ao contrário do Funil de
 * Conversão acima, que mostra só onde os leads estão agora). Responde
 * "quantos leads novos tivemos, quantos qualificamos, quantos propomos...".
 */
export default function StageThroughputWidget({ orgSlug, pipelineId }: Props) {
  const [period, setPeriod] = useState<FunnelPeriod>('30d')

  const { data: stages = [], isFetching } = useQuery({
    queryKey: ['stage-throughput', orgSlug, pipelineId, period],
    queryFn: () => fetchStageThroughput(orgSlug, { period, pipelineId }),
    placeholderData: keepPreviousData,
  })

  const maxCount = useMemo(
    () => Math.max(1, ...stages.map((s: StageThroughputRow) => s.count)),
    [stages],
  )
  const hasAnyData = stages.some((s: StageThroughputRow) => s.count > 0)

  return (
    <Card className={`${CHART_CARD_H} flex flex-col overflow-hidden`}>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 space-y-0 shrink-0 pb-2">
        <div>
          <CardTitle className="text-base">Funil Histórico</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Leads que entraram em cada estágio no período — soma em todos os estágios percorridos.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <select
            className="h-8 rounded-md border border-input bg-input/25 px-2 text-xs"
            value={period}
            onChange={e => setPeriod(e.target.value as FunnelPeriod)}
          >
            {(Object.keys(PERIOD_LABELS) as FunnelPeriod[]).map(p => (
              <option key={p} value={p}>
                {PERIOD_LABELS[p]}
              </option>
            ))}
          </select>
          {isFetching && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 flex flex-col">
        {!hasAnyData ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Nenhuma entrada de estágio no período selecionado.
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex items-stretch gap-3 pt-2 pb-1">
            {stages.map((stage: StageThroughputRow) => {
              const heightPct = Math.max(6, (stage.count / maxCount) * 100)
              const color = stage.stage_color || '#0f62fe'

              return (
                <div key={stage.stage_id} className="flex flex-col items-center flex-1 min-w-0">
                  <div className="flex-1 w-full flex items-end justify-center min-h-0">
                    <div
                      className="w-full max-w-[56px] rounded-t-md"
                      style={{ height: `${heightPct}%`, backgroundColor: color }}
                    />
                  </div>
                  <div className="mt-2 text-center min-w-0 w-full">
                    <div className="text-base font-bold tabular-nums leading-tight">{stage.count}</div>
                    <div className="text-xs font-medium truncate" title={stage.stage_name}>{stage.stage_name}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
