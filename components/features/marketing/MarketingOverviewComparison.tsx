'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ComparisonStat } from './MarketingOverviewControls'
import { fmtCurrency, fmtNumber, type MetricContext } from './MarketingOverviewShared'

type PreviousTotals = { spend_cents: number; impressions: number; clicks: number; meta_leads: number; meta_messaging_started: number; meta_purchases: number }

export default function MarketingOverviewComparison({
  filteredTotals,
  previousFilteredTotals,
  hasPreviousData,
}: {
  filteredTotals: MetricContext
  previousFilteredTotals: PreviousTotals
  hasPreviousData: boolean
}) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-base">Comparação com o período anterior</CardTitle>
        <p className="text-xs text-muted-foreground">
          Mesma duração do período selecionado, imediatamente anterior a ele.
        </p>
      </CardHeader>
      <CardContent>
        {!hasPreviousData ? (
          <div className="h-[100px] flex items-center justify-center text-sm text-muted-foreground text-center px-4">
            Sem dados suficientes no período anterior pra comparar (considerando a conta/objetivo selecionados).
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <ComparisonStat
              label="Investimento"
              current={filteredTotals.spend_cents}
              previous={previousFilteredTotals.spend_cents}
              format={fmtCurrency}
            />
            <ComparisonStat
              label="Impressões"
              current={filteredTotals.impressions}
              previous={previousFilteredTotals.impressions}
              format={fmtNumber}
            />
            <ComparisonStat
              label="Cliques"
              current={filteredTotals.clicks}
              previous={previousFilteredTotals.clicks}
              format={fmtNumber}
            />
            <ComparisonStat
              label="CPC médio"
              current={filteredTotals.clicks > 0 ? Math.round(filteredTotals.spend_cents / filteredTotals.clicks) : 0}
              previous={previousFilteredTotals.clicks > 0 ? Math.round(previousFilteredTotals.spend_cents / previousFilteredTotals.clicks) : 0}
              format={fmtCurrency}
              invertColor
            />
            {(() => {
              // Conversões = conversas iniciadas + leads + compras da
              // Meta — mesmo conceito agregado usado em
              // metricRegistry.cost_per_conversion, só que aqui
              // comparando atual vs. período anterior.
              const curConversions = filteredTotals.meta_messaging_started + filteredTotals.meta_leads + filteredTotals.meta_purchases
              const prevConversions = previousFilteredTotals.meta_messaging_started + previousFilteredTotals.meta_leads + previousFilteredTotals.meta_purchases
              return (
                <>
                  <ComparisonStat
                    label="Conversões"
                    current={curConversions}
                    previous={prevConversions}
                    format={fmtNumber}
                  />
                  <ComparisonStat
                    label="Custo por conversa"
                    current={filteredTotals.meta_messaging_started > 0 ? Math.round(filteredTotals.spend_cents / filteredTotals.meta_messaging_started) : 0}
                    previous={previousFilteredTotals.meta_messaging_started > 0 ? Math.round(previousFilteredTotals.spend_cents / previousFilteredTotals.meta_messaging_started) : 0}
                    format={fmtCurrency}
                    invertColor
                  />
                  <ComparisonStat
                    label="CPM"
                    current={filteredTotals.impressions > 0 ? Math.round((filteredTotals.spend_cents / filteredTotals.impressions) * 1000) : 0}
                    previous={previousFilteredTotals.impressions > 0 ? Math.round((previousFilteredTotals.spend_cents / previousFilteredTotals.impressions) * 1000) : 0}
                    format={fmtCurrency}
                    invertColor
                  />
                  <ComparisonStat
                    label="Custo por conversão"
                    current={curConversions > 0 ? Math.round(filteredTotals.spend_cents / curConversions) : 0}
                    previous={prevConversions > 0 ? Math.round(previousFilteredTotals.spend_cents / prevConversions) : 0}
                    format={fmtCurrency}
                    invertColor
                  />
                </>
              )
            })()}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
