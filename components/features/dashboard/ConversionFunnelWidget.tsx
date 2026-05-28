'use client'

import { useState, useTransition, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Filter, TrendingDown, ArrowDown, Loader2 } from 'lucide-react'
import {
  fetchFunnel,
  type FunnelPeriod,
  type FunnelSource,
  type FunnelResult,
} from '@/actions/funnel'

type SourceOptions = {
  forms: Array<{ id: string; name: string }>
  campaigns: Array<{ name: string; utm_campaign: string }>
  utmSources: string[]
}

type Props = {
  orgSlug: string
  pipelineId: string | null
  initialResult: FunnelResult
  sourceOptions: SourceOptions
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

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    (cents || 0) / 100,
  )
}

/**
 * Encodes a FunnelSource into a stable string for the dropdown value,
 * and decodes back. Avoids holding two pieces of state in sync.
 */
function encodeSource(s: FunnelSource): string {
  switch (s.kind) {
    case 'all':
      return 'all'
    case 'manual':
      return 'manual'
    case 'form':
      return `form:${s.formId}`
    case 'campaign':
      return `campaign:${s.utmCampaign}`
    case 'utm_source':
      return `utm_source:${s.value}`
  }
}

function decodeSource(s: string): FunnelSource {
  if (s === 'all' || !s) return { kind: 'all' }
  if (s === 'manual') return { kind: 'manual' }
  if (s.startsWith('form:')) return { kind: 'form', formId: s.slice(5) }
  if (s.startsWith('campaign:')) return { kind: 'campaign', utmCampaign: s.slice(9) }
  if (s.startsWith('utm_source:')) return { kind: 'utm_source', value: s.slice(11) }
  return { kind: 'all' }
}

export default function ConversionFunnelWidget({
  orgSlug,
  pipelineId,
  initialResult,
  sourceOptions,
}: Props) {
  const [period, setPeriod] = useState<FunnelPeriod>('30d')
  const [sourceKey, setSourceKey] = useState<string>('all')
  const [result, setResult] = useState<FunnelResult>(initialResult)
  const [isPending, startTransition] = useTransition()

  // Re-fetch whenever filters change. We skip the initial render because
  // initialResult is already populated by the server with default filters.
  const firstRenderRef = useFirstRender()
  useEffect(() => {
    if (firstRenderRef) return
    startTransition(async () => {
      const next = await fetchFunnel(orgSlug, {
        period,
        source: decodeSource(sourceKey),
        pipelineId,
      })
      setResult(next)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, sourceKey, pipelineId])

  // Find the largest stage count so we can scale the bars relative to it.
  const maxCount = useMemo(
    () => Math.max(1, ...result.stages.map(s => s.count)),
    [result.stages],
  )

  const hasAnyData = result.total_leads > 0

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">Funil de Conversão</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Distribuição atual de leads por estágio, filtrável por origem.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <select
            className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
            value={period}
            onChange={e => setPeriod(e.target.value as FunnelPeriod)}
          >
            {(Object.keys(PERIOD_LABELS) as FunnelPeriod[]).map(p => (
              <option key={p} value={p}>
                {PERIOD_LABELS[p]}
              </option>
            ))}
          </select>
          <select
            className="h-8 rounded-md border border-input bg-transparent px-2 text-xs min-w-[160px]"
            value={sourceKey}
            onChange={e => setSourceKey(e.target.value)}
          >
            <option value="all">Todas as fontes</option>
            <option value="manual">Cadastrados manualmente</option>
            {sourceOptions.forms.length > 0 && (
              <optgroup label="Formulários">
                {sourceOptions.forms.map(f => (
                  <option key={f.id} value={`form:${f.id}`}>
                    {f.name}
                  </option>
                ))}
              </optgroup>
            )}
            {sourceOptions.campaigns.length > 0 && (
              <optgroup label="Campanhas (UTM)">
                {sourceOptions.campaigns.map(c => (
                  <option key={c.utm_campaign} value={`campaign:${c.utm_campaign}`}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            )}
            {sourceOptions.utmSources.length > 0 && (
              <optgroup label="Origem (utm_source)">
                {sourceOptions.utmSources.map(s => (
                  <option key={s} value={`utm_source:${s}`}>
                    {s}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary row */}
        <div className="grid grid-cols-3 gap-3 mb-5 pb-5 border-b">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Leads no funil
            </div>
            <div className="text-xl font-bold tabular-nums mt-0.5">{result.total_leads}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Conversão geral
            </div>
            <div className="text-xl font-bold tabular-nums mt-0.5">
              {result.overall_conversion_pct.toFixed(1)}%
            </div>
            <div className="text-[10px] text-muted-foreground">
              do 1º ao último estágio
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Valor agregado
            </div>
            <div className="text-xl font-bold tabular-nums mt-0.5">
              {fmtCurrency(result.total_value_cents)}
            </div>
          </div>
        </div>

        {/* Funnel bars */}
        {!hasAnyData ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Nenhum lead corresponde aos filtros selecionados.
          </div>
        ) : (
          <div className="space-y-1.5">
            {result.stages.map((stage, idx) => {
              const widthPct = (stage.count / maxCount) * 100
              const color = stage.color || '#3b82f6'
              const showConvBadge = idx > 0
              const isWorrying =
                showConvBadge && stage.conversion_from_previous > 0 && stage.conversion_from_previous < 30

              return (
                <div key={stage.id}>
                  {showConvBadge && (
                    <div className="flex items-center justify-center my-1">
                      <Badge
                        variant="outline"
                        className={`text-[10px] gap-1 ${
                          isWorrying
                            ? 'text-red-600 border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800'
                            : 'text-muted-foreground'
                        }`}
                      >
                        <ArrowDown className="w-2.5 h-2.5" />
                        {stage.conversion_from_previous.toFixed(0)}% conversão
                        {isWorrying && <TrendingDown className="w-2.5 h-2.5 ml-0.5" />}
                      </Badge>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    {/* Bar */}
                    <div className="flex-1 relative h-9 bg-muted/40 rounded-md overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 rounded-md transition-all duration-300"
                        style={{
                          width: `${widthPct}%`,
                          backgroundColor: `${color}33`,
                          borderLeft: `3px solid ${color}`,
                        }}
                      />
                      <div className="relative h-full flex items-center px-3 text-sm font-medium">
                        {stage.name}
                      </div>
                    </div>
                    {/* Numbers */}
                    <div className="w-24 text-right shrink-0">
                      <div className="text-sm font-bold tabular-nums">{stage.count}</div>
                      {stage.value_cents > 0 && (
                        <div className="text-[10px] text-muted-foreground tabular-nums">
                          {fmtCurrency(stage.value_cents)}
                        </div>
                      )}
                    </div>
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

/** Simple flag that becomes false after the first render. */
function useFirstRender(): boolean {
  const [first, setFirst] = useState(true)
  useEffect(() => {
    if (first) setFirst(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return first
}
