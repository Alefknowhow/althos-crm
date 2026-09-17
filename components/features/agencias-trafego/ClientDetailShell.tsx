'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { MobileSectionPicker, type MobileSection } from '@/components/features/mobile/MobileSectionPicker'
import TrafficClientProfileCard from '@/components/features/agencias-trafego/TrafficClientProfileCard'
import TrafficClientCampaignsCard from '@/components/features/agencias-trafego/TrafficClientCampaignsCard'
import ClientCampaignsTable from '@/components/features/agencias-trafego/ClientCampaignsTable'
import ClientSyncPanel from '@/components/features/agencias-trafego/ClientSyncPanel'
import ClientOverviewTab from '@/components/features/agencias-trafego/ClientOverviewTab'
import ClientPerformanceChart from '@/components/features/agencias-trafego/ClientPerformanceChart'
import ClientIntelligenceTab from '@/components/features/agencias-trafego/ClientIntelligenceTab'
import ClientTrackingTab from '@/components/features/agencias-trafego/ClientTrackingTab'
import ClientFunnelCard from '@/components/features/agencias-trafego/ClientFunnelCard'
import CampaignCreativesSection from '@/components/features/agencias-trafego/CampaignCreativesSection'
import ClientReportsTab from '@/components/features/agencias-trafego/ClientReportsTab'
import ClientContractTab from '@/components/features/agencias-trafego/ClientContractTab'
import MediaPlanBuilder from '@/components/features/agencias-trafego/MediaPlanBuilder'
import MarketingStrategistPanel from '@/components/features/agencias-trafego/MarketingStrategistPanel'
import type { MediaPlan, MediaPlanItem } from '@/actions/media-plans'
import type { TrafficClientProfile } from '@/actions/traffic-client-profile'
import type { Creative } from '@/actions/campaign-creatives'
import type { TrafficActivity } from '@/actions/trafego-history'
import type { ClientPerformanceSummary, ClientDailyPoint } from '@/actions/trafego-performance'
import type { MetaAdAccountOption } from '@/lib/meta/ads-oauth'
import type { TrackingLink } from '@/actions/tracking-links'
import type { ClientTrackingFunnel, ConvertedLead, LinkPerformance } from '@/actions/trafego-tracking'

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
 * Ambiente operacional de um cliente de tráfego — 8 abas (Traffic Command
 * Center, ver plano em C:\Users\aleft\.claude\plans\dazzling-baking-anchor.md).
 * Todo dado exibido aqui pertence exclusivamente a `clientId`: contas via
 * ad_accounts.contato_id, campanhas via join com essas contas, nunca "todas
 * as contas do workspace".
 */
export default function ClientDetailShell({
  orgSlug, clientId, clientName, clientEmail, clientPhone, orgName, profile, accounts, campaigns, creatives, sales, activities,
  performanceCurrent, performancePrevious, performanceSeries, lastSyncLabel, lastSyncDaysAgo,
  orgMetaConnected, assignableOptions, assignedElsewhere,
  trackingFunnel, trackingJourneys, trackingLinks, trackingLinkPerformance,
  mediaPlans, mediaPlanItems,
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
  creatives: Creative[]
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
}) {
  const router = useRouter()
  const [tab, setTab] = useState('visao-geral')
  const sections: MobileSection[] = [
    { key: 'visao-geral', label: 'Visão geral' },
    { key: 'analytics', label: 'Analytics' },
    { key: 'estrategia', label: 'Estratégia' },
    { key: 'criativos', label: 'Criativos' },
    { key: 'conversoes', label: 'Conversões' },
    { key: 'inteligencia', label: 'Inteligência' },
    { key: 'relatorios', label: 'Relatórios' },
    { key: 'contrato', label: 'Contrato & Financeiro' },
  ]
  const hasTrackingData = trackingFunnel.clicks > 0 || trackingLinks.length > 0

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

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <div className="sm:hidden">
          <MobileSectionPicker sections={sections} activeKey={tab} onChange={setTab} />
        </div>
        <TabsList className="hidden sm:flex flex-wrap h-auto">
          <TabsTrigger value="visao-geral">Visão geral</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="estrategia">Estratégia</TabsTrigger>
          <TabsTrigger value="criativos">Criativos</TabsTrigger>
          <TabsTrigger value="conversoes">Conversões</TabsTrigger>
          <TabsTrigger value="inteligencia">Inteligência</TabsTrigger>
          <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
          <TabsTrigger value="contrato">Contrato & Financeiro</TabsTrigger>
        </TabsList>

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
          />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <ClientPerformanceChart current={performanceCurrent} previous={performancePrevious} series={performanceSeries} />
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
          <MediaPlanBuilder
            orgSlug={orgSlug}
            contatoId={clientId}
            plans={mediaPlans}
            initialItems={mediaPlanItems}
            creatives={creatives.map(c => ({ id: c.id, title: c.title }))}
          />
          <MarketingStrategistPanel orgSlug={orgSlug} contatoId={clientId} onApplied={() => router.refresh()} />
        </TabsContent>

        <TabsContent value="criativos">
          <CampaignCreativesSection orgSlug={orgSlug} contatoId={clientId} creatives={creatives} />
        </TabsContent>

        <TabsContent value="conversoes">
          <ClientTrackingTab
            orgSlug={orgSlug}
            clientId={clientId}
            funnel={trackingFunnel}
            journeys={trackingJourneys}
            initialLinks={trackingLinks}
            linkPerformance={trackingLinkPerformance}
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
    </div>
  )
}
