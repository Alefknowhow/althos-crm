'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import TrafficClientProfileCard from '@/components/features/agencias-trafego/TrafficClientProfileCard'
import TrafficClientCampaignsCard from '@/components/features/agencias-trafego/TrafficClientCampaignsCard'
import CampaignCreativesSection from '@/components/features/agencias-trafego/CampaignCreativesSection'
import ClientHistorySection from '@/components/features/agencias-trafego/ClientHistorySection'
import type { TrafficClientProfile } from '@/actions/traffic-client-profile'
import type { Creative } from '@/actions/campaign-creatives'

type AdAccount = { id: string; provider: string; name: string; external_id: string | null; status: string }
type CampaignRow = {
  id: string
  name: string
  objective: string | null
  status: string
  ad_accounts: { name: string; provider: string } | null
  metrics: { impressions: number; clicks: number; spend_cents: number }
}
type SaleRow = { id: string; sale_date: string | null; amount_cents: number | null; status: string; products: { name: string } | null }

/**
 * Painel de gestão de um cliente de tráfego — camada separada de Contatos
 * (que continua sendo o cadastro padrão). Aqui vive tudo que é específico
 * da vertical: perfil da campanha, conta de anúncio vinculada, campanhas,
 * histórico e central de aprovação de criativos.
 */
export default function ClientDetailShell({
  orgSlug, clientId, clientName, profile, accounts, campaigns, creatives, sales,
}: {
  orgSlug: string
  clientId: string
  clientName: string
  profile: TrafficClientProfile | null
  accounts: AdAccount[]
  campaigns: CampaignRow[]
  creatives: Creative[]
  sales: SaleRow[]
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

      <Tabs defaultValue="dados" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="criativos">Criativos</TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="space-y-4">
          <TrafficClientProfileCard orgSlug={orgSlug} contatoId={clientId} initial={profile} />
          <TrafficClientCampaignsCard orgSlug={orgSlug} contatoId={clientId} accounts={accounts} campaigns={campaigns} />
        </TabsContent>

        <TabsContent value="historico" className="space-y-4">
          <ClientHistorySection sales={sales} />
        </TabsContent>

        <TabsContent value="criativos" className="space-y-4">
          <CampaignCreativesSection orgSlug={orgSlug} contatoId={clientId} creatives={creatives} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
