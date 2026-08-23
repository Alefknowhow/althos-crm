'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Lightbulb, AlertTriangle, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { computeClientAlerts, computeClientInsights } from '@/lib/trafego/alerts'
import type { ClientPerformanceSummary } from '@/actions/trafego-performance'
import type { TrafficClientProfile } from '@/actions/traffic-client-profile'

/**
 * Aba Inteligência — Insights/Alertas/Recomendações separados visualmente
 * (spec pede explicitamente não misturar tudo numa lista só). Computados em
 * runtime a partir da performance de 30d vs. período anterior — sem tabela
 * persistente/ciclo de vida (Novo/Em análise/Resolvido) nesta fase.
 */
export default function ClientIntelligenceTab({
  current, previous, profile, lastSyncDaysAgo,
}: {
  current: ClientPerformanceSummary
  previous: ClientPerformanceSummary
  profile: TrafficClientProfile | null
  lastSyncDaysAgo: number | null
}) {
  const insights = computeClientInsights(current, previous)
  const alerts = computeClientAlerts(current, previous, profile, lastSyncDaysAgo)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="w-4 h-4" /> Insights</CardTitle></CardHeader>
        <CardContent>
          {insights.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum insight no momento — performance dentro do esperado.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {insights.map((i, idx) => <li key={idx}>{i.text}</li>)}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Alertas</CardTitle></CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum alerta ativo.</p>
          ) : (
            <div className="space-y-2">
              {alerts.map((a, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm border rounded-md px-3 py-2">
                  <span className={cn('w-2 h-2 rounded-full shrink-0', a.severity === 'critico' ? 'bg-red-500' : 'bg-amber-500')} />
                  <div className="min-w-0">
                    <div className="font-medium">{a.title}</div>
                    <div className="text-xs text-muted-foreground">{a.reason}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Lightbulb className="w-4 h-4" /> Recomendações</CardTitle></CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nada a recomendar agora.</p>
          ) : (
            <div className="space-y-3">
              {alerts.map((a, idx) => (
                <div key={idx} className="border rounded-lg p-3 space-y-2">
                  <div className="font-medium text-sm">{a.title}</div>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Evidência:</span> {a.reason}
                  </p>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" disabled title="Diagnóstico detalhado — em breve">Analisar</Button>
                    <Button size="sm" variant="outline" disabled title="Execução automática ainda não disponível">Aplicar</Button>
                    <Button size="sm" variant="ghost">Ignorar</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
