import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { Skeleton } from '@/components/ui/skeleton'
import DashboardHeader from '@/components/features/dashboard/DashboardHeader'
import PeriodFilter from '@/components/features/dashboard/PeriodFilter'
import PipelineFilter from '@/components/features/dashboard/PipelineFilter'
import SellerFilter from '@/components/features/dashboard/SellerFilter'
import DashboardCustomizer from '@/components/features/dashboard/DashboardCustomizer'
import { Period, getAdvancedFunnel, getFunnelSourceOptions } from '@/actions/dashboard'
import { getDashboardLayout } from '@/actions/dashboard-layout'
import { WIDGET_REGISTRY, type WidgetCtx } from '@/lib/dashboard/widget-registry'
import { listOrgMembers } from '@/actions/sales'
import OnboardingChecklistCard from '@/components/features/onboarding/OnboardingChecklistCard'
import UpgradeBanner from '@/components/features/onboarding/UpgradeBanner'

export default async function OrgDashboard({
  params,
  searchParams,
}: {
  params: { orgSlug: string }
  searchParams: { period?: string; pipeline_id?: string; metric?: string; seller_id?: string }
}) {
  const org = await getCurrentOrganization(params.orgSlug)
  const user = await requireAuth()
  const layout = await getDashboardLayout(params.orgSlug)
  const period = (searchParams.period as Period) || (layout.periodDefault as Period) || '30d'
  const pipelineId = searchParams.pipeline_id || null
  const validMetrics = ['leads', 'revenue', 'sales', 'appointments'] as const
  const metric = (validMetrics as readonly string[]).includes(searchParams.metric || '')
    ? (searchParams.metric as (typeof validMetrics)[number])
    : 'leads'

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

  // Members power the seller filter dropdown + validate the seller_id param.
  const members = await listOrgMembers(params.orgSlug)
  const sellerIdParam = searchParams.seller_id || null
  const validSellerId =
    sellerIdParam && members.some(m => m.id === sellerIdParam) ? sellerIdParam : null

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

  const ctx: WidgetCtx = {
    orgSlug: params.orgSlug,
    orgId: org.id,
    period,
    pipelineId: validPipelineId,
    sellerId: validSellerId,
    metric,
    initialFunnel,
    funnelSourceOptions,
  }

  // Só renderiza (e busca dados de) widgets ativos no layout do usuário —
  // widgets ocultos não gastam query nenhuma até serem adicionados de volta.
  const renderedByKey: Record<string, React.ReactNode> = {}
  for (const key of layout.widgetKeys) {
    const def = WIDGET_REGISTRY.find(w => w.key === key)
    if (!def) continue
    renderedByKey[key] = (
      <Suspense key={key} fallback={<Skeleton className="h-[400px] w-full" />}>
        {def.render(ctx)}
      </Suspense>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8 pb-10">
      <UpgradeBanner orgSlug={params.orgSlug} />

      <Suspense fallback={null}>
        <OnboardingChecklistCard orgId={org.id} orgSlug={params.orgSlug} />
      </Suspense>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <DashboardHeader userName={userName} />
        <div className="flex items-center gap-3 flex-wrap">
          <PipelineFilter pipelines={pipelines || []} />
          <SellerFilter sellers={members.map(m => ({ id: m.id, name: m.name }))} />
          <PeriodFilter orgSlug={params.orgSlug} />
        </div>
      </div>

      <DashboardCustomizer
        orgSlug={params.orgSlug}
        widgetKeys={layout.widgetKeys}
        renderedByKey={renderedByKey}
      />
    </div>
  )
}
