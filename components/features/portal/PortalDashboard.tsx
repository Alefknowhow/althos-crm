'use client'

import { useRouter } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LogOut, FileText, Megaphone } from 'lucide-react'
import { portalLogout, getPortalReportUrl } from '@/actions/client-portal'
import { type PortalAdAccount, type PortalCampaign, type PortalConversion, type PortalTrackingHealth } from '@/actions/client-portal-data'
import type { PortalLibraryAssetChain } from '@/actions/client-portal-library'
import type { ClientPerformanceSummary, ClientDailyPoint } from '@/actions/trafego-performance'
import PortalConversionsCard from './PortalConversionsCard'
import PortalLibraryTab from './PortalLibraryTab'
import PortalOverviewTab from './PortalOverviewTab'
import PortalCampaignsTable from './PortalCampaignsTable'
import PortalTrackingTab from './PortalTrackingTab'

type Report = { id: string; filename: string | null; created_at: string; period_start: string | null; period_end: string | null }

/**
 * Interface simples de propósito — o cliente externo vê resultado + o que
 * precisa fazer, não a complexidade do gestor (spec § 26). Sem edição de
 * estratégia, campanhas ou dados internos: só o que foi liberado pra ele.
 */
export default function PortalDashboard({
  contatoId, clientName, orgName, overview, dailySeries, availablePlatforms, validatedConversions, reports, libraryChains, adAccounts, campaigns, conversions, trackingHealth,
}: {
  contatoId: string
  clientName: string
  orgName: string
  overview: { current: ClientPerformanceSummary; previous: ClientPerformanceSummary }
  dailySeries: ClientDailyPoint[]
  availablePlatforms: string[]
  validatedConversions: number
  reports: Report[]
  libraryChains: PortalLibraryAssetChain[]
  adAccounts: PortalAdAccount[]
  campaigns: PortalCampaign[]
  conversions: PortalConversion[]
  trackingHealth: PortalTrackingHealth
}) {
  const router = useRouter()

  async function handleLogout() {
    await portalLogout()
    router.push('/portal/login')
  }

  async function handleDownloadReport(reportId: string) {
    const res = await getPortalReportUrl(contatoId, reportId)
    if (res.ok) window.open(res.url, '_blank')
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="border-b bg-background px-4 sm:px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-lg">{clientName}</h1>
          <p className="text-xs text-muted-foreground">{orgName}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout}><LogOut className="w-4 h-4 mr-1.5" /> Sair</Button>
      </div>

      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <Tabs defaultValue="visao-geral">
          <TabsList>
            <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
            <TabsTrigger value="contas">Contas</TabsTrigger>
            <TabsTrigger value="biblioteca">Biblioteca</TabsTrigger>
            <TabsTrigger value="conversoes">Conversões</TabsTrigger>
            <TabsTrigger value="tracking">Tracking</TabsTrigger>
            <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
          </TabsList>

          <TabsContent value="visao-geral" className="mt-4">
            <PortalOverviewTab
              contatoId={contatoId}
              initial={overview}
              initialSeries={dailySeries}
              availablePlatforms={availablePlatforms}
              validatedConversions={validatedConversions}
            />
          </TabsContent>

          <TabsContent value="contas" className="mt-4 space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Megaphone className="w-4 h-4" /> Contas de anúncio</CardTitle></CardHeader>
              <CardContent>
                {adAccounts.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma conta vinculada ainda.</p>
                ) : (
                  <div className="divide-y">
                    {adAccounts.map(a => (
                      <div key={a.id} className="flex items-center justify-between py-2 text-sm">
                        <span className="font-medium">{a.name}</span>
                        <span className="text-xs text-muted-foreground capitalize">{a.provider} · {a.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Campanhas (30 dias)</CardTitle></CardHeader>
              <CardContent>
                <PortalCampaignsTable contatoId={contatoId} campaigns={campaigns} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="biblioteca" className="mt-4">
            <PortalLibraryTab contatoId={contatoId} chains={libraryChains} />
          </TabsContent>

          <TabsContent value="conversoes" className="mt-4">
            <PortalConversionsCard contatoId={contatoId} initial={conversions} />
          </TabsContent>

          <TabsContent value="tracking" className="mt-4">
            <PortalTrackingTab health={trackingHealth} />
          </TabsContent>

          <TabsContent value="relatorios" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><FileText className="w-4 h-4" /> Relatórios</CardTitle></CardHeader>
              <CardContent>
                {reports.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Nenhum relatório disponível ainda.</p>
                ) : (
                  <div className="divide-y">
                    {reports.map(r => (
                      <div key={r.id} className="flex items-center justify-between py-2.5 text-sm">
                        <div>
                          <div className="font-medium">{r.period_start && r.period_end ? `${r.period_start} a ${r.period_end}` : r.filename}</div>
                          <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString('pt-BR')}</div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => handleDownloadReport(r.id)}>Baixar PDF</Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
