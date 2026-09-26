'use client'

/**
 * "Plataforma × Real" (#27/#61 2.6) — duas colunas rotuladas explicitamente
 * pra nunca deixar o leitor achar que são a mesma métrica:
 *  - "Reportado pela plataforma": meta_leads/investimento de
 *    campaign_metrics_daily (o que a Meta/Google dizem que entregaram).
 *  - "Real no Althos": leads/vendas/receita atribuídos ao cliente pela
 *    mesma fonte que getClientPerformanceSummaryCore usa (tabela `sales`,
 *    filtrada por contato_id + status='completed'), + conversões manuais
 *    do Portal já **validadas** pela agência (nunca as pendentes — ver
 *    portal_conversions.validated_at, passo 2.5).
 * ROAS real = receita real / investimento, só quando ambos > 0.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import type { ClientPerformanceSummary } from '@/actions/trafego-performance'

function Row({ label, platform, real }: { label: string; platform: string; real: string }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-2 text-sm border-b last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums text-right">{platform}</span>
      <span className="tabular-nums text-right font-medium">{real}</span>
    </div>
  )
}

export default function PlatformVsRealCard({
  summary, validatedManualConversions = 0,
}: {
  summary: ClientPerformanceSummary
  /** Conversões manuais do Portal já validadas pela agência (passo 2.5) — somadas às vendas reais. */
  validatedManualConversions?: number
}) {
  const realRoas = summary.investmentCents > 0 && summary.revenueCents > 0
    ? summary.revenueCents / summary.investmentCents
    : null

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Plataforma × Real no Althos</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2 pb-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium border-b">
          <span>Métrica</span>
          <span className="text-right">Reportado pela plataforma</span>
          <span className="text-right">Real no Althos</span>
        </div>
        <Row label="Investimento" platform={formatCurrency(summary.investmentCents)} real="—" />
        <Row label="Leads" platform={String(summary.leads)} real="—" />
        <Row
          label="Vendas/conversões"
          platform="—"
          real={`${summary.salesCount + validatedManualConversions}${validatedManualConversions > 0 ? ` (${validatedManualConversions} do Portal)` : ''}`}
        />
        <Row label="Receita" platform="—" real={formatCurrency(summary.revenueCents)} />
        <Row label="ROAS" platform="—" real={realRoas != null ? `${realRoas.toFixed(1)}x` : '—'} />
        <p className="text-[11px] text-muted-foreground pt-2">
          Nunca some as duas colunas: investimento/leads vêm do relatório da plataforma de anúncios; vendas/receita vêm de vendas reais registradas no Althos (+ conversões do Portal já validadas pela agência).
        </p>
      </CardContent>
    </Card>
  )
}
