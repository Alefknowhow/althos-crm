import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, ExternalLink, CheckCircle2 } from 'lucide-react'
import { getAtRiskLeads } from '@/actions/dashboard'

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    (cents || 0) / 100,
  )
}

/**
 * Server component that fetches at-risk leads and renders them grouped
 * by stage with a clear visual hierarchy: stage header (with risk count)
 * and per-lead row (with days stuck + value + link to detail).
 *
 * Threshold is currently a constant (7 days) — could be made user-editable
 * by lifting to a client wrapper and adding a select; deferred for v1.
 */
export default async function PipelineAtRiskWidget({
  orgSlug,
  orgId,
  pipelineId,
}: {
  orgSlug: string
  orgId: string
  pipelineId: string | null
}) {
  const stages = await getAtRiskLeads(orgId, { thresholdDays: 7, pipelineId, perStageLimit: 5 })

  const totalAtRisk = stages.reduce((a, s) => a + s.at_risk_count, 0)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            Pipeline em risco
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Leads sem atividade há mais de 7 dias por estágio. Hora de ligar.
          </p>
        </div>
        {totalAtRisk > 0 ? (
          <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-900/20">
            {totalAtRisk} parados
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent>
        {stages.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500 opacity-70" />
            Nenhum lead parado há mais de 7 dias. Pipeline saudável.
          </div>
        ) : (
          <div className="space-y-4">
            {stages.map(stage => (
              <div key={stage.stage_id}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: stage.stage_color || '#3b82f6' }}
                    />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {stage.stage_name}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {stage.at_risk_count} de {stage.total_in_stage}
                  </span>
                </div>
                <div className="space-y-1">
                  {stage.leads.map(lead => (
                    <Link
                      key={lead.id}
                      href={`/app/${orgSlug}/leads/${lead.id}`}
                      className="flex items-center justify-between px-3 py-2 rounded-md border hover:bg-muted hover:border-primary/40 transition-all group text-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="font-medium truncate">{lead.name}</span>
                        {lead.value_cents > 0 && (
                          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                            {fmtCurrency(lead.value_cents)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge
                          variant="outline"
                          className={`text-[10px] tabular-nums ${
                            lead.days_stuck >= 30
                              ? 'text-red-700 border-red-300 bg-red-50 dark:bg-red-900/20'
                              : lead.days_stuck >= 14
                                ? 'text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-900/20'
                                : 'text-muted-foreground'
                          }`}
                        >
                          há {lead.days_stuck}d
                        </Badge>
                        <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </Link>
                  ))}
                  {stage.at_risk_count > stage.leads.length && (
                    <Link
                      href={`/app/${orgSlug}/leads?no_contact_days=7&stage=${stage.stage_id}`}
                      className="block text-center text-[11px] text-primary hover:underline py-1"
                    >
                      Ver todos ({stage.at_risk_count}) →
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
