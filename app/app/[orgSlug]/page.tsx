import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { Skeleton } from '@/components/ui/skeleton'
import DashboardHeader from '@/components/features/dashboard/DashboardHeader'
import PeriodFilter from '@/components/features/dashboard/PeriodFilter'
import PipelineFilter from '@/components/features/dashboard/PipelineFilter'
import MetricsWidget from '@/components/features/dashboard/MetricsWidget'
import TimeSeriesWidget from '@/components/features/dashboard/TimeSeriesWidget'
import ConversionFunnelWidget from '@/components/features/dashboard/ConversionFunnelWidget'
import PipelineAtRiskWidget from '@/components/features/dashboard/PipelineAtRiskWidget'
import TimeInStageWidget from '@/components/features/dashboard/TimeInStageWidget'
import RevenueForecastWidget from '@/components/features/dashboard/RevenueForecastWidget'
import SourcePerformanceWidget from '@/components/features/dashboard/SourcePerformanceWidget'
import SellersRankingWidget from '@/components/features/dashboard/SellersRankingWidget'
import RecentActivityWidget from '@/components/features/dashboard/RecentActivityWidget'
import LeadSourcesWidget from '@/components/features/dashboard/LeadSourcesWidget'
import TasksTodayWidget from '@/components/features/dashboard/TasksTodayWidget'
import { Period, getAdvancedFunnel, getFunnelSourceOptions } from '@/actions/dashboard'

export default async function OrgDashboard({
  params,
  searchParams,
}: {
  params: { orgSlug: string }
  searchParams: { period?: string; pipeline_id?: string }
}) {
  const org = await getCurrentOrganization(params.orgSlug)
  const user = await requireAuth()
  const period = (searchParams.period as Period) || '30d'
  const pipelineId = searchParams.pipeline_id || null

  const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuário'

  // Pipelines list is small (per org) and shared by both filter UI and the
  // pipeline_id validation — fetch once at the page level.
  const supabase = createClient()
  const { data: pipelines } = await supabase
    .from('pipelines')
    .select('id, name')
    .eq('organization_id', org.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })

  // Validate the URL param against the org's pipelines so a bogus id doesn't
  // silently filter to nothing.
  const validPipelineId = pipelineId && (pipelines || []).some(p => p.id === pipelineId)
    ? pipelineId
    : null

  // Initial funnel data (default filters: 30d + all sources) so the widget
  // paints with content on first load. User filters re-fetch via server action.
  const [initialFunnel, funnelSourceOptions] = await Promise.all([
    getAdvancedFunnel(org.id, {
      period: '30d',
      source: { kind: 'all' },
      pipelineId: validPipelineId,
    }),
    getFunnelSourceOptions(org.id),
  ])

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <DashboardHeader userName={userName} />
        <div className="flex items-center gap-3 flex-wrap">
          <PipelineFilter pipelines={pipelines || []} />
          <PeriodFilter />
        </div>
      </div>

      <Suspense
        fallback={
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        }
      >
        <MetricsWidget orgId={org.id} period={period} pipelineId={validPipelineId} />
      </Suspense>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Suspense fallback={<Skeleton className="h-[400px] w-full" />}>
            <TimeSeriesWidget orgId={org.id} period={period} pipelineId={validPipelineId} />
          </Suspense>
        </div>
        <div>
          <Suspense fallback={<Skeleton className="h-[400px] w-full" />}>
            <LeadSourcesWidget orgId={org.id} period={period} pipelineId={validPipelineId} />
          </Suspense>
        </div>
      </div>

      {/* Featured row: Conversion funnel takes 2/3 of width since it's
          the centerpiece of the dashboard with its own filters. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ConversionFunnelWidget
            orgSlug={params.orgSlug}
            pipelineId={validPipelineId}
            initialResult={initialFunnel}
            sourceOptions={funnelSourceOptions}
          />
        </div>
        <Suspense fallback={<Skeleton className="h-[450px] w-full" />}>
          <TasksTodayWidget orgId={org.id} orgSlug={params.orgSlug} />
        </Suspense>
      </div>

      {/* Diagnostic + action row: at-risk leads (where to act NOW) +
          time-in-stage (where the bottleneck IS). Pair the funnel with these
          to get a complete picture: WHERE drops + WHY + WHO to call. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Suspense fallback={<Skeleton className="h-[450px] w-full" />}>
            <PipelineAtRiskWidget
              orgSlug={params.orgSlug}
              orgId={org.id}
              pipelineId={validPipelineId}
            />
          </Suspense>
        </div>
        <div>
          <Suspense fallback={<Skeleton className="h-[450px] w-full" />}>
            <TimeInStageWidget orgId={org.id} pipelineId={validPipelineId} />
          </Suspense>
        </div>
      </div>

      {/* Strategic row: Forecast (predict future) + Source (which channel pays
          off) + Sellers (who closes more). All three are 1/3 width to fit
          comfortably side-by-side. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Suspense fallback={<Skeleton className="h-[400px] w-full" />}>
          <RevenueForecastWidget orgId={org.id} pipelineId={validPipelineId} />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-[400px] w-full" />}>
          <SourcePerformanceWidget orgId={org.id} pipelineId={validPipelineId} />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-[400px] w-full" />}>
          <SellersRankingWidget orgSlug={params.orgSlug} orgId={org.id} />
        </Suspense>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
        <Suspense fallback={<Skeleton className="h-[300px] w-full" />}>
          <RecentActivityWidget orgId={org.id} />
        </Suspense>
      </div>
    </div>
  )
}
