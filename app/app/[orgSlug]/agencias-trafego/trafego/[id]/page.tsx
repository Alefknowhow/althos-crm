import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import { getTrafficClientProfile } from '@/actions/traffic-client-profile'
import { listAdAccountsByClient, listCampaignsByClient } from '@/actions/marketing'
import { listAssetChains } from '@/actions/library-assets'
import { listClientActivity } from '@/actions/trafego-history'
import { getClientPerformanceComparison, getClientDailySeries } from '@/actions/trafego-performance'
import { listAdAccountsForToken, type MetaAdAccountOption } from '@/lib/meta/ads-oauth'
import { listAssignableMetaAdAccounts } from '@/actions/marketing'
import { listTrackingLinksByClient } from '@/actions/tracking-links'
import { getClientTrackingFunnel, listClientConvertedJourneys, listLinkPerformance, getClientTrackingHealth } from '@/actions/trafego-tracking'
import { listMediaPlans, getMediaPlanWithItems, type MediaPlanItem } from '@/actions/media-plans'
import ClientDetailShell from '@/components/features/agencias-trafego/ClientDetailShell'
import SelectMetaAdAccountsForClient from '@/components/features/agencias-trafego/SelectMetaAdAccountsForClient'
import { requireModuleEnabled } from '@/lib/module-flags'
import { listProjects } from '@/actions/projects'
import { listProjectColumns } from '@/actions/project-columns'
import { listProjectTemplates } from '@/actions/project-templates'
import { listOrgMembers } from '@/actions/team'

export const dynamic = 'force-dynamic'

export default async function TrafficClientDetailPage({
  params, searchParams,
}: { params: { orgSlug: string; id: string }; searchParams: { meta_step?: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  await requireModuleEnabled(org.niche, 'trafego')

  const supabase = createClient()
  const { data: client } = await supabase
    .from('contatos')
    .select('id, name, email, phone')
    .eq('id', params.id)
    .eq('organization_id', org.id)
    .maybeSingle()

  if (!client) redirect(`/app/${params.orgSlug}/agencias-trafego/trafego`)

  // Voltando do OAuth do Facebook (app/api/meta-ads/connect com clientId) —
  // mostra a seleção de contas em vez do painel normal do cliente.
  if (searchParams.meta_step === 'select') {
    const cookieStore = cookies()
    const token = cookieStore.get('meta_ads_pending_token')?.value
    const pendingOrg = cookieStore.get('meta_ads_pending_org')?.value
    const pendingClient = cookieStore.get('meta_ads_pending_client')?.value

    if (token && pendingOrg === params.orgSlug && pendingClient === params.id) {
      let options: MetaAdAccountOption[] = []
      let error: string | null = null
      try {
        options = await listAdAccountsForToken(token)
      } catch (e: any) {
        error = e?.message || 'Falha ao listar contas de anúncio'
      }
      return (
        <div className="p-4 sm:p-6 max-w-2xl mx-auto">
          <SelectMetaAdAccountsForClient orgSlug={params.orgSlug} clientId={params.id} options={options} listError={error} />
        </div>
      )
    }
  }

  const now = new Date()
  const range30d = { from: new Date(now.getTime() - 29 * 86_400_000), to: now }

  const [profile, accounts, campaigns, libraryChains, { data: sales }, activities, { current, previous }, series, trackingFunnel, trackingJourneys, trackingLinks, trackingLinkPerformance, trackingHealth] = await Promise.all([
    getTrafficClientProfile(params.orgSlug, params.id),
    listAdAccountsByClient(params.orgSlug, params.id),
    listCampaignsByClient(params.orgSlug, params.id),
    listAssetChains(params.orgSlug, params.id),
    supabase
      .from('sales')
      .select('id, sale_date, amount_cents, status, products(name)')
      .eq('contato_id', params.id)
      .eq('organization_id', org.id)
      .order('sale_date', { ascending: false }),
    listClientActivity(params.orgSlug, params.id),
    getClientPerformanceComparison(params.orgSlug, params.id, range30d),
    getClientDailySeries(params.orgSlug, params.id, range30d),
    getClientTrackingFunnel(params.orgSlug, params.id, range30d),
    listClientConvertedJourneys(params.orgSlug, params.id, range30d),
    listTrackingLinksByClient(params.orgSlug, params.id),
    listLinkPerformance(params.orgSlug, params.id, range30d),
    getClientTrackingHealth(params.orgSlug, params.id),
  ])

  const mediaPlans = await listMediaPlans(params.orgSlug, params.id)
  const mediaPlanItems: MediaPlanItem[] = mediaPlans[0]
    ? (await getMediaPlanWithItems(params.orgSlug, mediaPlans[0].id))?.items || []
    : []

  const [projects, projectColumns, projectTemplates, members] = await Promise.all([
    listProjects(params.orgSlug, { clientId: params.id }),
    listProjectColumns(params.orgSlug),
    listProjectTemplates(params.orgSlug),
    listOrgMembers(params.orgSlug),
  ])
  const memberName = new Map(members.map((m: any) => [m.user_id, m.name]))
  const enrichedProjects = projects.map(p => ({
    ...p,
    owner: p.owner_id ? { id: p.owner_id, name: memberName.get(p.owner_id) || null, email: null } : null,
  }))

  const lastSyncedAt = (accounts as any[])
    .map(a => a.updated_at || a.created_at)
    .filter(Boolean)
    .sort()
    .pop() as string | undefined
  const lastSyncDaysAgo = lastSyncedAt ? Math.floor((now.getTime() - new Date(lastSyncedAt).getTime()) / 86_400_000) : null
  const lastSyncLabel = lastSyncedAt
    ? (lastSyncDaysAgo === 0 ? 'hoje' : lastSyncDaysAgo === 1 ? 'há 1 dia' : `há ${lastSyncDaysAgo} dias`)
    : null

  // Só busca as contas Meta acessíveis pelo login já conectado da agência
  // quando este cliente ainda não tem conta vinculada (ver ClientSyncPanel) —
  // evita chamada à Graph API sem necessidade quando já está tudo linkado.
  let orgMetaConnected = false
  let assignableOptions: MetaAdAccountOption[] = []
  let assignedElsewhere: string[] = []
  if (accounts.length === 0) {
    const res = await listAssignableMetaAdAccounts(params.orgSlug)
    if (res.ok) {
      orgMetaConnected = res.connected
      assignableOptions = res.options
      assignedElsewhere = res.assignedElsewhere
    }
  }

  return (
    <ClientDetailShell
      orgSlug={params.orgSlug}
      clientId={client.id}
      clientName={client.name}
      clientEmail={client.email ?? null}
      clientPhone={client.phone ?? null}
      orgName={org.name}
      profile={profile}
      accounts={accounts as any[]}
      campaigns={campaigns as any[]}
      libraryChains={libraryChains}
      sales={(sales || []) as any[]}
      activities={activities}
      performanceCurrent={current}
      performancePrevious={previous}
      performanceSeries={series}
      lastSyncLabel={lastSyncLabel}
      lastSyncDaysAgo={lastSyncDaysAgo}
      orgMetaConnected={orgMetaConnected}
      assignableOptions={assignableOptions}
      assignedElsewhere={assignedElsewhere}
      trackingFunnel={trackingFunnel}
      trackingJourneys={trackingJourneys}
      trackingLinks={trackingLinks}
      trackingLinkPerformance={trackingLinkPerformance}
      trackingHealth={trackingHealth}
      mediaPlans={mediaPlans}
      mediaPlanItems={mediaPlanItems}
      projects={enrichedProjects as any}
      projectColumns={projectColumns}
      projectTemplates={projectTemplates}
      members={members as any}
    />
  )
}
