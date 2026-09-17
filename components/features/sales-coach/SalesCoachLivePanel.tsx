'use client'

import { Lightbulb, TrendingUp, AlertTriangle, Target, Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { SalesContext, SalesEvent } from '@/lib/sales-coach/types'
import type { NextBestAction } from '@/lib/sales-coach/next-best-action'

const ACTION_LABELS: Record<NextBestAction['action'], string> = {
  PERGUNTE: 'Pergunte',
  APROFUNDE: 'Aprofunde',
  QUANTIFIQUE: 'Quantifique',
  INVESTIGUE: 'Investigue',
  RESPONDA: 'Responda',
  AVANCE: 'Avance',
  SEGURE: 'Segure',
}

function InfoList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-1">{title}</p>
      <ul className="space-y-0.5">
        {items.map((item, i) => (
          <li key={i} className="text-sm">
            • {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Painel de decisão do IA Sales Coach (spec §20 Sales Coach Live) — fatia
 * 5. Consome o resultado das engines já processado pelo caller
 * (SalesCoachLiveSpike.tsx via /api/sales-coach/process-turn), puramente
 * apresentacional.
 */
export function SalesCoachLivePanel({
  context,
  events,
  nextBestAction,
}: {
  context: SalesContext | null
  events: SalesEvent[]
  nextBestAction: NextBestAction | null
}) {
  if (!context) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          O painel de contexto aparece aqui assim que a IA processar os primeiros minutos da conversa.
        </CardContent>
      </Card>
    )
  }

  const recentEvents = [...events].slice(-6).reverse()

  return (
    <div className="space-y-4">
      {nextBestAction && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="p-4 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-primary uppercase tracking-wide">
              <Lightbulb className="w-3.5 h-3.5" /> {ACTION_LABELS[nextBestAction.action]}
            </div>
            <p className="text-sm font-medium">{nextBestAction.message}</p>
            <p className="text-xs text-muted-foreground">{nextBestAction.reasoning}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <Target className="w-4 h-4" /> Progresso da call
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Etapa</p>
              <p>{context.currentSalesStage || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sentimento</p>
              <p className="capitalize">{context.sentiment || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Orçamento</p>
              <p>{context.budget || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Objetivo recomendado</p>
              <p>{context.recommendedObjective || '—'}</p>
            </div>
          </div>

          <InfoList title="Dores" items={context.pains} />
          <InfoList title="Necessidades" items={context.needs} />
          <InfoList title="Objeções" items={context.objections} />
          <InfoList title="Sinais de compra" items={context.buyingSignals} />
          <InfoList title="Concorrentes mencionados" items={context.competitors} />
          <InfoList title="Próximos passos" items={context.nextSteps} />
        </CardContent>
      </Card>

      {recentEvents.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-1.5 text-sm font-medium mb-1">
              <Clock className="w-4 h-4" /> Eventos recentes
            </div>
            {recentEvents.map((e, i) => (
              <div key={i} className="flex items-start gap-2 text-sm border-t pt-2 first:border-t-0 first:pt-0">
                {e.type === 'OBJECTION_DETECTED' || e.type === 'RISK_DETECTED' ? (
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-destructive" />
                ) : (
                  <TrendingUp className="w-3.5 h-3.5 shrink-0 mt-0.5 text-success" />
                )}
                <div>
                  <p>{e.summary}</p>
                  {e.suggestion && <p className="text-xs text-muted-foreground">{e.suggestion}</p>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
