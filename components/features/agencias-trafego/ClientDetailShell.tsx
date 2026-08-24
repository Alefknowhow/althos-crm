'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import TrafficClientProfileCard from '@/components/features/agencias-trafego/TrafficClientProfileCard'
import TrafficClientCampaignsCard from '@/components/features/agencias-trafego/TrafficClientCampaignsCard'
import ClientCampaignsTable from '@/components/features/agencias-trafego/ClientCampaignsTable'
import ClientSyncPanel from '@/components/features/agencias-trafego/ClientSyncPanel'
import ClientOverviewTab from '@/components/features/agencias-trafego/ClientOverviewTab'
import ClientIntelligenceTab from '@/components/features/agencias-trafego/ClientIntelligenceTab'
import ClientTrackingTab from '@/components/features/agencias-trafego/ClientTrackingTab'
import CampaignCreativesSection from '@/components/features/agencias-trafego/CampaignCreativesSection'
import ClientHistorySection from '@/components/features/agencias-trafego/ClientHistorySection'
import type { TrafficClientProfile } from '@/actions/traffic-client-profile'
import type { Creative } from '@/actions/campaign-creatives'
import type { TrafficActivity } from '@/actions/trafego-history'
import type { ClientPerformanceSummary, ClientDailyPoint } from '@/actions/trafego-performance'
import type { MetaAdAccountOption } from '@/lib/meta/ads-oauth'

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
  orgSlug, clientId, clientName, profile, accounts, campaigns, creatives, sales, activities,
  performanceCurrent, performancePrevious, performanceSeries, lastSyncLabel, lastSyncDaysAgo,
  orgMetaConnected, assignableOptions, assignedElsewhere,
}: {
  orgSlug: string
  clientId: string
  clientName: string
  profile: TrafficClientProfile | null
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
}) {
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

      <Tabs defaultValue="visao-geral" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="visao-geral">Visão geral</TabsTrigger>
          <TabsTrigger value="estrategia">Estratégia</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="campanhas">Campanhas</TabsTrigger>
          <TabsTrigger value="criativos">Criativos</TabsTrigger>
          <TabsTrigger value="tracking">Tracking</TabsTrigger>
          <TabsTrigger value="inteligencia">Inteligência</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
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

        <TabsContent value="estrategia">
          <TrafficClientProfileCard orgSlug={orgSlug} contatoId={clientId} initial={profile} />
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
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
        </TabsContent>

        <TabsContent value="campanhas">
          <ClientCampaignsTable campaigns={campaigns} />
        </TabsContent>

        <TabsContent value="criativos">
          <CampaignCreativesSection orgSlug={orgSlug} contatoId={clientId} creatives={creatives} />
        </TabsContent>

        <TabsContent value="tracking">
          <ClientTrackingTab />
        </TabsContent>

        <TabsContent value="inteligencia">
          <ClientIntelligenceTab
            current={performanceCurrent}
            previous={performancePrevious}
            profile={profile}
            lastSyncDaysAgo={lastSyncDaysAgo}
          />
        </TabsContent>

        <TabsContent value="historico">
          <ClientHistorySection sales={sales} activities={activities} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
