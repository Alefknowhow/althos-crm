'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Waypoints } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { ClientTrackingFunnel } from '@/actions/trafego-tracking'

const STEPS: { key: keyof ClientTrackingFunnel; label: string; format: 'currency' | 'number' }[] = [
  { key: 'investmentCents', label: 'Investimento', format: 'currency' },
  { key: 'clicks', label: 'Cliques', format: 'number' },
  { key: 'leads', label: 'Leads', format: 'number' },
  { key: 'sales', label: 'Vendas', format: 'number' },
  { key: 'revenueCents', label: 'Receita', format: 'currency' },
]

function fmt(value: number, format: 'currency' | 'number'): string {
  return format === 'currency' ? formatCurrency(value) : value.toLocaleString('pt-BR')
}

/**
 * Funil de investimento→cliques→leads→vendas→receita de um cliente, a
 * partir de tracking_links/tracking_clicks (Fase 1 do rastreamento
 * próprio). Extraído de ClientTrackingTab.tsx pra ser reaproveitado
 * também em Estratégia — mesmo dado, dois lugares de leitura.
 */
export default function ClientFunnelCard({
  funnel, hasData, title = 'Funil (30 dias)',
}: {
  funnel: ClientTrackingFunnel
  hasData: boolean
  title?: string
}) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="py-8 text-center space-y-2">
            <Waypoints className="w-8 h-8 mx-auto text-muted-foreground" />
            <p className="text-sm font-medium">Nenhum link de rastreamento criado ainda.</p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Crie um link na aba Tracking e use ele nos anúncios desse cliente — o funil aparece aqui assim que os primeiros cliques chegarem.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-stretch gap-2">
              {STEPS.map((s, i) => (
                <div key={s.key} className="flex items-center gap-2">
                  <div className="rounded-lg border bg-background px-4 py-3 min-w-[110px]">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{s.label}</div>
                    <div className="text-lg font-bold tabular-nums">{fmt(funnel[s.key] as number, s.format)}</div>
                  </div>
                  {i < STEPS.length - 1 && <span className="text-muted-foreground">→</span>}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">CPL</div>
                <div className="font-semibold tabular-nums">{funnel.cplCents != null ? formatCurrency(funnel.cplCents) : '—'}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">CPA</div>
                <div className="font-semibold tabular-nums">{funnel.cpaCents != null ? formatCurrency(funnel.cpaCents) : '—'}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">ROAS</div>
                <div className="font-semibold tabular-nums">{funnel.roas != null ? `${funnel.roas.toFixed(1)}x` : '—'}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Clique → Lead</div>
                <div className="font-semibold tabular-nums">{funnel.clickToLeadPct != null ? `${funnel.clickToLeadPct.toFixed(1)}%` : '—'}</div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
