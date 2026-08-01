import type { Period, FunnelResult } from '@/actions/dashboard'

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
