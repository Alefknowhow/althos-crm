'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { MobileSectionPicker, type MobileSection } from '@/components/features/mobile/MobileSectionPicker'
import TrafficClientProfileCard from '@/components/features/agencias-trafego/TrafficClientProfileCard'
import TrafficClientCampaignsCard from '@/components/features/agencias-trafego/TrafficClientCampaignsCard'
import ClientCampaignsTable from '@/components/features/agencias-trafego/ClientCampaignsTable'
import ClientSyncPanel from '@/components/features/agencias-trafego/ClientSyncPanel'
import ClientOverviewTab from '@/components/features/agencias-trafego/ClientOverviewTab'
import PlatformVsRealCard from '@/components/features/trafego/PlatformVsRealCard'
import ClientPerformanceChart from '@/components/features/agencias-trafego/ClientPerformanceChart'
import ClientIntelligenceTab from '@/components/features/agencias-trafego/ClientIntelligenceTab'
import ClientTrackingTab from '@/components/features/agencias-trafego/ClientTrackingTab'
import ClientFunnelCard from '@/components/features/agencias-trafego/ClientFunnelCard'
import LibraryAssetsSection from '@/components/features/agencias-trafego/LibraryAssetsSection'
import ClientReportsTab from '@/components/features/agencias-trafego/ClientReportsTab'
import ClientContractTab from '@/components/features/agencias-trafego/ClientContractTab'
import MediaPlanBuilder from '@/components/features/agencias-trafego/MediaPlanBuilder'
import MarketingStrategistDock from '@/components/features/agencias-trafego/MarketingStrategistDock'
import ProjectsView from '@/components/features/agenda/projetos/ProjectsView'
import type { ProjectRow } from '@/actions/projects'
import type { ProjectColumn } from '@/actions/project-columns'
import type { ProjectTemplateRow } from '@/actions/project-templates'
import type { MediaPlan, MediaPlanItem } from '@/actions/media-plans'
import type { TrafficClientProfile } from '@/actions/traffic-client-profile'
import type { LibraryAssetChain } from '@/actions/library-assets'
import type { TrafficActivity } from '@/actions/trafego-history'
import type { ClientPerformanceSummary, ClientDailyPoint } from '@/actions/trafego-performance'
import type { MetaAdAccountOption } from '@/lib/meta/ads-oauth'
import type { TrackingLink } from '@/actions/tracking-links'
import type { ClientTrackingFunnel, ClientTrackingHealth, ConvertedLead, LinkPerformance } from '@/actions/trafego-tracking'
import type { ClientPortalConversion } from '@/actions/portal-conversions-review'

type AdAccount = { id: string; provider: string; name: string; external_id: string | null; status: string }
type CampaignRow = {
  id: string
  name: string
  objective: string | null
  status: string
  ad_accounts: { name: string; provider: string } | null
  metrics: { impressions: number; clicks: number; spend_cents: number; leads: number }
}
type SaleRow = { id: string; sale_date: string | null; amount_cents: number | null; status: string; products: { name: string } | null }

/**
 * Ambiente operacional de um cliente de tráfego — 9 seções (Estratégia e
 * Estrutura de Campanhas separadas, antes uma coisa só). A navegação entre
 * elas mora na sidebar principal do app (SidebarClientAccordion, acordeão
 * "Clientes" — igual Configurações), não numa coluna própria aqui dentro
 * (era redundante). A aba ativa vive em `?tab=` na URL, é isso que deixa a
 * sidebar linkar direto pra uma aba específica. Todo dado exibido aqui
 * pertence exclusivamente a `clientId`: contas via ad_accounts.contato_id,
 * campanhas via join com essas contas, nunca "todas as contas do
 * workspace". O Marketing Strategist (IA) é um painel lateral fixo
 * (MarketingStrategistDock), disponível em qualquer seção.
 */
export default function ClientDetailShell({
  orgSlug, clientId, clientName, clientEmail, clientPhone, orgName, profile, accounts, campaigns, libraryChains, sales, activities,
  performanceCurrent, performancePrevious, performanceSeries, lastSyncLabel, lastSyncDaysAgo,
  orgMetaConnected, assignableOptions, assignedElsewhere,
  trackingFunnel, trackingJourneys, trackingLinks, trackingLinkPerformance, trackingHealth, portalConversions,
  mediaPlans, mediaPlanItems, projects, projectColumns, projectTemplates, members,
}: {
  orgSlug: string
  clientId: string
  clientName: string
  clientEmail: string | null
  clientPhone: string | null
  orgName: string
  profile: TrafficClientProfile | null
  mediaPlans: MediaPlan[]
  mediaPlanItems: MediaPlanItem[]
  accounts: AdAccount[]
  campaigns: CampaignRow[]
  libraryChains: LibraryAssetChain[]
  sales: SaleRow[]
  activities: TrafficActivity[]
  performanceCurrent: ClientPerformanceSummary
  performancePrevious: ClientPerformanceSummary
  performanceSeries: ClientDailyPoint[]
  lastSyncLabel: string | null
  lastSyncDaysAgo: number | null
  orgMetaConnected: boolean
  assignableOptions: MetaAdAccountOption[]
  assignedElsewhere: string[]
  trackingFunnel: ClientTrackingFunnel
  trackingJourneys: ConvertedLead[]
  trackingLinks: TrackingLink[]
  trackingLinkPerformance: LinkPerformance[]
  trackingHealth: ClientTrackingHealth
  portalConversions: ClientPortalConversion[]
  projects: ProjectRow[]
  projectColumns: ProjectColumn[]
  projectTemplates: ProjectTemplateRow[]
  members: { user_id: string; name: string }[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  // A aba ativa vive na URL (?tab=), não em estado local — é isso que
  // permite o item "Clientes" da sidebar principal (SidebarClientAccordion)
  // linkar direto pra uma aba específica deste cliente e destacar a aba
  // certa, em vez de duplicar a navegação numa coluna própria da página.
  const tab = searchParams.get('tab') || 'visao-geral'
  function setTab(next: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', next)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const sections: MobileSection[] = [
    { key: 'visao-geral', label: 'Visão geral' },
    { key: 'analytics', label: 'Analytics' },
    { key: 'estrategia', label: 'Estratégia' },
    { key: 'campanhas', label: 'Estrutura de Campanhas' },
    { key: 'biblioteca', label: 'Biblioteca' },
    { key: 'conversoes', label: 'Conversões' },
    { key: 'inteligencia', label: 'Inteligência' },
    { key: 'projetos', label: 'Projetos' },
    { key: 'relatorios', label: 'Relatórios' },
    { key: 'contrato', label: 'Contrato & Financeiro' },
  ]
  const hasTrackingData = trackingFunnel.clicks > 0 || trackingLinks.length > 0
  const validatedManualConversions = portalConversions.filter(c => c.type === 'venda' && c.validatedAt).length

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href={`/app/${orgSlug}/agencias-trafego/trafego`}>
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>
        <h1 className="text-xl font-bold tracking-tight">{clientName}</h1>
      </div>

      <div className="sm:hidden">
        <MobileSectionPicker sections={sections} activeKey={tab} onChange={setTab} />
      </div>

      {/* Navegação entre as 9 seções mora na sidebar principal
          (SidebarClientAccordion, acordeão "Clientes") — não duplica mais
          uma coluna própria aqui dentro (era redundante: a mesma lista já
          aparecia nos dois lugares). */}
      <Tabs value={tab} onValueChange={setTab} className="min-w-0">
        <TabsContent value="visao-geral">
          <ClientOverviewTab
            orgSlug={orgSlug}
            clientId={clientId}
            clientName={clientName}
            profile={profile}
            lastSyncLabel={lastSyncLabel}
            lastSyncDaysAgo={lastSyncDaysAgo}
            initialCurrent={performanceCurrent}
            initialPrevious={performancePrevious}
            initialSeries={performanceSeries}
            validatedManualConversions={validatedManualConversions}
          />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <ClientPerformanceChart current={performanceCurrent} previous={performancePrevious} series={performanceSeries} />
          <PlatformVsRealCard summary={performanceCurrent} validatedManualConversions={validatedManualConversions} />
          <ClientSyncPanel
            orgSlug={orgSlug}
            clientId={clientId}
            accounts={accounts}
            performance={performanceCurrent}
            orgMetaConnected={orgMetaConnected}
            assignableOptions={assignableOptions}
            assignedElsewhere={assignedElsewhere}
          />
          <TrafficClientCampaignsCard orgSlug={orgSlug} contatoId={clientId} accounts={accounts} campaigns={campaigns} />
          <ClientCampaignsTable campaigns={campaigns} />
        </TabsContent>

        <TabsContent value="estrategia" className="space-y-4">
          <TrafficClientProfileCard orgSlug={orgSlug} contatoId={clientId} initial={profile} />
          <ClientFunnelCard funnel={trackingFunnel} hasData={hasTrackingData} title="Funil (30 dias)" />
        </TabsContent>

        <TabsContent value="campanhas">
          <MediaPlanBuilder
            orgSlug={orgSlug}
            contatoId={clientId}
            plans={mediaPlans}
            initialItems={mediaPlanItems}
            creatives={libraryChains.filter(c => c.latest.kind === 'produzido').map(c => ({ id: c.latest.id, title: c.latest.title }))}
          />
        </TabsContent>

        <TabsContent value="biblioteca">
          <LibraryAssetsSection orgSlug={orgSlug} contatoId={clientId} chains={libraryChains} campaigns={campaigns.map(c => ({ id: c.id, name: c.name }))} />
        </TabsContent>

        <TabsContent value="conversoes">
          <ClientTrackingTab
            orgSlug={orgSlug}
            clientId={clientId}
            funnel={trackingFunnel}
            journeys={trackingJourneys}
            initialLinks={trackingLinks}
            linkPerformance={trackingLinkPerformance}
            trackingHealth={trackingHealth}
            portalConversions={portalConversions}
          />
        </TabsContent>

        <TabsContent value="inteligencia">
          <ClientIntelligenceTab
            current={performanceCurrent}
            previous={performancePrevious}
            profile={profile}
            lastSyncDaysAgo={lastSyncDaysAgo}
          />
        </TabsContent>

        <TabsContent value="projetos">
          <ProjectsView
            orgSlug={orgSlug}
            projects={projects}
            columns={projectColumns}
            templates={projectTemplates}
            clients={[{ id: clientId, name: clientName }]}
            members={members}
            hideClientFilter
          />
        </TabsContent>

        <TabsContent value="relatorios">
          <ClientReportsTab
            orgSlug={orgSlug}
            clientId={clientId}
            clientName={clientName}
            orgName={orgName}
            current={performanceCurrent}
            previous={performancePrevious}
            funnel={trackingFunnel}
            hasFunnelData={hasTrackingData}
            campaigns={campaigns}
            sales={sales}
            activities={activities}
          />
        </TabsContent>

        <TabsContent value="contrato">
          <ClientContractTab
            orgSlug={orgSlug}
            clientId={clientId}
            clientName={clientName}
            clientEmail={clientEmail}
            clientPhone={clientPhone}
            profile={profile}
            sales={sales}
          />
        </TabsContent>
      </Tabs>

      <MarketingStrategistDock orgSlug={orgSlug} contatoId={clientId} onApplied={() => router.refresh()} />
    </div>
  )
}
