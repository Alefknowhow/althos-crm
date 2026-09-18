import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Target } from 'lucide-react'
import { getMqlSqlByCampaign } from '@/actions/dashboard-tabs'
import type { Period } from '@/actions/dashboard-core'
import { sinceFromPeriod } from '@/lib/dashboard/period'
import { COMPACT_CARD_H } from './dashboardSizes'

/**
 * MQL/SQL por campanha — colunas pareadas (MQL cheio, SQL sólido por cima)
 * por campanha, no mesmo padrão visual de coluna do Funil de Conversão
 * (StageThroughputWidget). Ver getMqlSqlByCampaign para a definição de
 * MQL/SQL usada (proxy — não existe campo dedicado no schema).
 */
export default async function MqlSqlBySourceWidget({
  orgId, pipelineId, period,
}: {
  orgId: string
  pipelineId: string | null
  period: Period
}) {
  const rows = await getMqlSqlByCampaign(orgId, sinceFromPeriod(period), { pipelineId })
  const maxValue = Math.max(1, ...rows.map(r => r.mql))
  const hasAnyData = rows.some(r => r.mql > 0)

  return (
    <Card className={`${COMPACT_CARD_H} flex flex-col overflow-hidden`}>
      <CardHeader className="shrink-0 pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          MQL / SQL por campanha
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          MQL = qualificado pela IA (quente/morno) · SQL = MQL já assumido por um responsável.
        </p>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 flex flex-col">
        {!hasAnyData ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Nenhum lead qualificado pela IA no período.
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-2 shrink-0">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-primary/25 shrink-0" /> MQL
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-primary shrink-0" /> SQL
              </span>
            </div>
            <div className="flex-1 min-h-0 flex items-stretch gap-3 pt-1 pb-1 overflow-x-auto">
              {rows.map(r => {
                const mqlHeightPct = Math.max(6, (r.mql / maxValue) * 100)
                const sqlHeightPct = r.mql > 0 ? (r.sql / r.mql) * mqlHeightPct : 0
                return (
                  <div key={r.campaign} className="flex flex-col items-center flex-1 min-w-[64px]">
                    <div className="flex-1 w-full flex items-end justify-center min-h-0 relative">
                      <div
                        className="w-full max-w-[56px] rounded-t-md bg-primary/25 relative overflow-hidden"
                        style={{ height: `${mqlHeightPct}%` }}
                      >
                        <div
                          className="absolute bottom-0 left-0 w-full bg-primary"
                          style={{ height: `${sqlHeightPct}%` }}
                        />
                      </div>
                    </div>
                    <div className="mt-2 text-center min-w-0 w-full">
                      <div className="text-sm font-bold tabular-nums leading-tight">
                        {r.mql} <span className="text-muted-foreground font-normal">/ {r.sql}</span>
                      </div>
                      <div className="text-[11px] font-medium truncate" title={r.campaign}>{r.campaign}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
