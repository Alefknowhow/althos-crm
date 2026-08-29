import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Target } from 'lucide-react'
import { getLeadSourceReturns } from '@/actions/dashboard-tabs'
import { COMPACT_CARD_H, LIST_SCROLL_H } from './dashboardSizes'
import MockBarListCard from './mocks/MockBarListCard'
import { MOCK_CAMPAIGN_ROAS } from './mocks/mockData'

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}

/**
 * Retorno por origem do lead — nicho viagens. Cada linha é uma origem
 * (WhatsApp, Instagram, Formulário, Manual, etc.), rankeada por comissão
 * total (dado principal), com a receita total como referência secundária.
 * Fora do nicho viagens ainda não há um critério de retorno definido — cai
 * no placeholder anterior (ROAS por campanha, dado mockado).
 */
export default async function LeadSourceReturnsWidget({ orgId, since }: { orgId: string; since: Date }) {
  const rows = await getLeadSourceReturns(orgId, since)

  if (rows === null) {
    return (
      <MockBarListCard
        title="Ranking de campanhas (ROAS)"
        help="Retorno sobre investimento por campanha Meta Ads — depende de vincular venda a campanha."
        icon={Target}
        rows={MOCK_CAMPAIGN_ROAS}
        color="#0f62fe"
      />
    )
  }

  const maxCommission = Math.max(1, ...rows.map(r => r.commission_cents))

  return (
    <Card className={`${COMPACT_CARD_H} flex flex-col`}>
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="w-4 h-4 text-blue-600" />
          Retorno por origem do lead
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Comissão total gerada por origem do lead, com a receita total como referência.
        </p>
      </CardHeader>
      <CardContent className={`${LIST_SCROLL_H} overflow-y-auto shrink-0`}>
        {rows.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma venda com lead de origem identificada no período.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map(r => (
              <div key={r.source}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium truncate">{r.source}</span>
                  <span className="text-muted-foreground shrink-0 ml-2 tabular-nums">
                    {fmtCurrency(r.commission_cents)} <span className="opacity-70">· {fmtCurrency(r.revenue_cents)}</span>
                  </span>
                </div>
                <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500/70"
                    style={{ width: `${(r.commission_cents / maxCommission) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
