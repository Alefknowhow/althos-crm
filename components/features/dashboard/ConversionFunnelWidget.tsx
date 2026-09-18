'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Filter, Loader2 } from 'lucide-react'
import {
  fetchFunnel,
  type FunnelPeriod,
  type FunnelSource,
  type FunnelResult,
} from '@/actions/funnel'
import { CHART_CARD_H } from './dashboardSizes'

type FunnelStage = FunnelResult['stages'][number]

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
  const router = useRouter()
  const [period, setPeriod] = useState<FunnelPeriod>('30d')
  const [sourceKey, setSourceKey] = useState<string>('all')

  // useQuery cacheia por chave (org+pipeline+filtros) — voltar pra uma
  // combinação de filtro já vista (ex.: trocar de aba Comercial → Visão
  // Geral e voltar) reusa o resultado em cache em vez de refazer a query.
  // `initialData` na combinação default evita um fetch redundante logo na
  // primeira renderização, já que o server já mandou esse resultado pronto.
  const isDefaultFilters = period === '30d' && sourceKey === 'all'
  const { data: result = initialResult, isFetching } = useQuery({
    queryKey: ['funnel', orgSlug, pipelineId, period, sourceKey],
    queryFn: () => fetchFunnel(orgSlug, { period, source: decodeSource(sourceKey), pipelineId }),
    initialData: isDefaultFilters ? initialResult : undefined,
    placeholderData: keepPreviousData,
  })
  const isPending = isFetching

  // Find the largest stage count so we can scale the bars relative to it.
  const maxCount = useMemo(
    () => Math.max(1, ...result.stages.map(s => s.count)),
    [result.stages],
  )

  const hasAnyData = result.total_leads > 0

  return (
    <Card className={`${CHART_CARD_H} flex flex-col overflow-hidden`}>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 space-y-0 shrink-0 pb-2">
        <div>
          <CardTitle className="text-base">Pipeline</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Distribuição atual de leads por estágio, filtrável por origem.
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
          <select
            className="h-8 rounded-md border border-input bg-input/25 px-2 text-xs min-w-[160px]"
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
      <CardContent className="flex-1 min-h-0 flex flex-col">
        {/* Summary row */}
        <div className="grid grid-cols-3 gap-3 mb-3 pb-3 border-b shrink-0">
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

        {/* Funil de verdade — segmentos horizontais centralizados, cada um
            um trapézio (bordas laterais na diagonal) que afunila da
            contagem da própria etapa até a contagem da próxima, com pouco
            espaçamento entre as linhas e o dado no centro de cada uma. */}
        {!hasAnyData ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Nenhum lead corresponde aos filtros selecionados.
          </div>
        ) : (
          <FunnelChart
            stages={result.stages}
            maxCount={maxCount}
            fmtCurrency={fmtCurrency}
            onOpen={() => router.push(`/app/${orgSlug}/pipeline${pipelineId ? `?pipeline_id=${pipelineId}` : ''}`)}
          />
        )}
      </CardContent>
    </Card>
  )
}

/** Funil de barras horizontais retas e centralizadas — sem taper diagonal
 *  entre etapas. Linha grossa, espaçamento generoso entre elas (dá espaço
 *  pro dado, sempre centralizado dentro da própria barra, ficar legível). */
function FunnelChart({
  stages, maxCount, fmtCurrency, onOpen,
}: {
  stages: FunnelStage[]
  maxCount: number
  fmtCurrency: (cents: number) => string
  onOpen: () => void
}) {
  const MIN_PCT = 28

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={e => { if (e.key === 'Enter') onOpen() }}
      title="Ver no Pipeline"
      className="flex-1 min-h-0 flex flex-col justify-center gap-3 py-1 cursor-pointer"
    >
      {stages.map((stage, i) => {
        const widthPct = MIN_PCT + (100 - MIN_PCT) * (stage.count / maxCount)
        const fill = stage.color || `var(--chart-${(i % 6) + 1})`
        return (
          <div key={stage.id} className="flex justify-center">
            <div
              className="h-14 rounded-md flex flex-col items-center justify-center text-center px-4 transition-opacity hover:opacity-90 min-w-0"
              style={{ width: `${widthPct}%`, backgroundColor: fill }}
            >
              <div className="text-[13px] font-bold text-white leading-tight tabular-nums truncate max-w-full">
                {stage.count} · {stage.name}
              </div>
              <div className="text-[10px] text-white/80 leading-tight tabular-nums truncate max-w-full">
                {i > 0 ? `${stage.conversion_from_previous.toFixed(0)}% · ` : ''}
                {stage.value_cents > 0 ? fmtCurrency(stage.value_cents) : ''}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
