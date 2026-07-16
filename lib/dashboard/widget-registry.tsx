import type { ReactNode } from 'react'
import type { Period, FunnelResult } from '@/actions/dashboard'
import { WIDGET_CATALOG, getWidgetMeta, type WidgetSize } from './widget-catalog'

import MetricsWidget from '@/components/features/dashboard/MetricsWidget'
import MetricChartWidget from '@/components/features/dashboard/MetricChartWidget'
import ConversionFunnelWidget from '@/components/features/dashboard/ConversionFunnelWidget'
import PipelineAtRiskWidget from '@/components/features/dashboard/PipelineAtRiskWidget'
import TimeInStageWidget from '@/components/features/dashboard/TimeInStageWidget'
import RevenueForecastWidget from '@/components/features/dashboard/RevenueForecastWidget'
import SourcePerformanceWidget from '@/components/features/dashboard/SourcePerformanceWidget'
import SellersRankingWidget from '@/components/features/dashboard/SellersRankingWidget'
import RecentActivityWidget from '@/components/features/dashboard/RecentActivityWidget'
import LeadSourcesWidget from '@/components/features/dashboard/LeadSourcesWidget'
import TasksTodayWidget from '@/components/features/dashboard/TasksTodayWidget'

export type { WidgetSize }

export type SourceOptions = {
  forms: Array<{ id: string; name: string }>
  campaigns: Array<{ name: string; utm_campaign: string }>
  utmSources: string[]
}

/** Tudo que um widget pode precisar para se renderizar — nem todos usam tudo. */
export type WidgetCtx = {
  orgSlug: string
  orgId: string
  period: Period
  pipelineId: string | null
  sellerId: string | null
  metric: 'leads' | 'revenue' | 'sales' | 'appointments'
  initialFunnel: FunnelResult
  funnelSourceOptions: SourceOptions
}

const RENDERERS: Record<string, (ctx: WidgetCtx) => ReactNode> = {
  metrics: ctx => (
    <MetricsWidget orgId={ctx.orgId} period={ctx.period} pipelineId={ctx.pipelineId} sellerId={ctx.sellerId} />
  ),
  metric_chart: ctx => (
    <MetricChartWidget
      orgId={ctx.orgId}
      period={ctx.period}
      metric={ctx.metric}
      pipelineId={ctx.pipelineId}
      sellerId={ctx.sellerId}
    />
  ),
  lead_sources: ctx => <LeadSourcesWidget orgId={ctx.orgId} period={ctx.period} pipelineId={ctx.pipelineId} />,
  funnel: ctx => (
    <ConversionFunnelWidget
      orgSlug={ctx.orgSlug}
      pipelineId={ctx.pipelineId}
      initialResult={ctx.initialFunnel}
      sourceOptions={ctx.funnelSourceOptions}
    />
  ),
  tasks_today: ctx => <TasksTodayWidget orgId={ctx.orgId} orgSlug={ctx.orgSlug} />,
  pipeline_at_risk: ctx => (
    <PipelineAtRiskWidget orgSlug={ctx.orgSlug} orgId={ctx.orgId} pipelineId={ctx.pipelineId} />
  ),
  time_in_stage: ctx => <TimeInStageWidget orgId={ctx.orgId} pipelineId={ctx.pipelineId} />,
  revenue_forecast: ctx => (
    <RevenueForecastWidget orgId={ctx.orgId} pipelineId={ctx.pipelineId} orgSlug={ctx.orgSlug} />
  ),
  source_performance: ctx => <SourcePerformanceWidget orgId={ctx.orgId} pipelineId={ctx.pipelineId} />,
  sellers_ranking: ctx => <SellersRankingWidget orgSlug={ctx.orgSlug} orgId={ctx.orgId} />,
  recent_activity: ctx => <RecentActivityWidget orgId={ctx.orgId} />,
}

export type WidgetDef = {
  key: string
  label: string
  size: WidgetSize
  render: (ctx: WidgetCtx) => ReactNode
}

export const WIDGET_REGISTRY: WidgetDef[] = WIDGET_CATALOG.map(meta => ({
  ...meta,
  render: RENDERERS[meta.key],
}))

export function getWidgetDef(key: string): WidgetDef | undefined {
  const meta = getWidgetMeta(key)
  const render = RENDERERS[key]
  if (!meta || !render) return undefined
  return { ...meta, render }
}
