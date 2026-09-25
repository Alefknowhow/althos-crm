'use client'

import { useRouter } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LogOut, FileText, Image as ImageIcon, Loader2, FolderOpen, Megaphone } from 'lucide-react'
import { useState } from 'react'
import { formatCurrency } from '@/lib/utils'
import { portalLogout, getPortalReportUrl } from '@/actions/client-portal'
import {
  getOrCreatePortalAssetLink,
  type PortalLibraryAsset, type PortalAdAccount, type PortalCampaign, type PortalConversion,
} from '@/actions/client-portal-data'
import type { ClientPerformanceSummary } from '@/actions/trafego-performance'
import PortalConversionsCard from './PortalConversionsCard'

const CAMPAIGN_STATUS_LABEL: Record<string, { label: string; className: string }> = {
  active: { label: 'Ativa', className: 'bg-green-100 text-green-800 border-green-200' },
  paused: { label: 'Pausada', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  archived: { label: 'Arquivada', className: 'bg-muted text-muted-foreground' },
}

type Report = { id: string; filename: string | null; created_at: string; period_start: string | null; period_end: string | null }
type Creative = { id: string; title: string; media_type: string; status: string; public_token: string | null; created_at: string }

const CREATIVE_STATUS_LABEL: Record<string, { label: string; className: string }> = {
  pendente: { label: 'Aguardando sua aprovação', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  aprovado: { label: 'Aprovado', className: 'bg-green-100 text-green-800 border-green-200' },
  reprovado: { label: 'Alteração solicitada', className: 'bg-red-100 text-red-800 border-red-200' },
}

const LIBRARY_STATUS_LABEL: Record<string, { label: string; className: string }> = {
  pendente: { label: 'Aguardando sua aprovação', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  aprovado: { label: 'Aprovado', className: 'bg-green-100 text-green-800 border-green-200' },
  alteracao_solicitada: { label: 'Alteração solicitada', className: 'bg-red-100 text-red-800 border-red-200' },
}
const LIBRARY_KIND_LABEL: Record<string, string> = { bruto: 'Material bruto', produzido: 'Criativo produzido' }

/**
 * Interface simples de propósito — o cliente externo vê resultado + o que
 * precisa fazer, não a complexidade do gestor (spec § 26). Sem edição de
 * estratégia, campanhas ou dados internos: só o que foi liberado pra ele.
 */
export default function PortalDashboard({
  contatoId, clientName, orgName, overview, reports, creatives, libraryAssets, adAccounts, campaigns, conversions,
}: {
  contatoId: string
  clientName: string
  orgName: string
  overview: ClientPerformanceSummary
  reports: Report[]
  creatives: Creative[]
  libraryAssets: PortalLibraryAsset[]
  adAccounts: PortalAdAccount[]
  campaigns: PortalCampaign[]
  conversions: PortalConversion[]
}) {
  const router = useRouter()
  const [openingAssetId, setOpeningAssetId] = useState<string | null>(null)

  async function handleOpenAsset(asset: PortalLibraryAsset) {
    if (asset.publicToken) {
      window.open(`/biblioteca/${asset.publicToken}`, '_blank')
      return
    }
    setOpeningAssetId(asset.id)
    const res = await getOrCreatePortalAssetLink(contatoId, asset.id)
    setOpeningAssetId(null)
    if (res.ok) window.open(`/biblioteca/${res.token}`, '_blank')
  }

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
            <TabsTrigger value="criativos">Aprovação de Criativos</TabsTrigger>
            <TabsTrigger value="biblioteca">Biblioteca</TabsTrigger>
            <TabsTrigger value="conversoes">Conversões</TabsTrigger>
            <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
          </TabsList>

          <TabsContent value="visao-geral" className="space-y-4 mt-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Performance (30 dias)</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Kpi label="Investimento" value={formatCurrency(overview.investmentCents)} />
                <Kpi label="Leads" value={String(overview.leads)} />
                <Kpi label="Conversões" value={String(overview.salesCount)} />
                <Kpi label="Receita" value={formatCurrency(overview.revenueCents)} />
                <Kpi label="CPL" value={overview.cplCents != null ? formatCurrency(overview.cplCents) : '—'} />
                <Kpi label="ROAS" value={overview.roas != null ? `${overview.roas.toFixed(1)}x` : '—'} />
              </CardContent>
            </Card>
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
                {campaigns.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma campanha nesse período.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b">
                          <th className="py-2 pr-3 font-medium">Campanha</th>
                          <th className="py-2 pr-3 font-medium">Status</th>
                          <th className="py-2 pr-3 font-medium text-right">Investimento</th>
                          <th className="py-2 pr-3 font-medium text-right">Leads</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {campaigns.map(c => {
                          const status = CAMPAIGN_STATUS_LABEL[c.status] || CAMPAIGN_STATUS_LABEL.active
                          return (
                            <tr key={c.id}>
                              <td className="py-2 pr-3">
                                <div className="font-medium truncate max-w-[220px]">{c.name}</div>
                                <div className="text-xs text-muted-foreground">{c.ad_accounts?.name || '—'}</div>
                              </td>
                              <td className="py-2 pr-3"><Badge variant="outline" className={status.className}>{status.label}</Badge></td>
                              <td className="py-2 pr-3 text-right tabular-nums font-medium">{formatCurrency(c.metrics.spend_cents)}</td>
                              <td className="py-2 pr-3 text-right tabular-nums">{c.metrics.leads || '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="criativos" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><ImageIcon className="w-4 h-4" /> Criativos</CardTitle></CardHeader>
              <CardContent>
                {creatives.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Nenhum criativo enviado ainda.</p>
                ) : (
                  <div className="divide-y">
                    {creatives.map(c => {
                      const status = CREATIVE_STATUS_LABEL[c.status] || CREATIVE_STATUS_LABEL.pendente
                      return (
                        <div key={c.id} className="flex items-center justify-between py-2.5 text-sm">
                          <span className="font-medium">{c.title}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={status.className}>{status.label}</Badge>
                            {c.public_token && (
                              <Button size="sm" variant="outline" asChild>
                                <a href={`/criativo/${c.public_token}`} target="_blank" rel="noreferrer">Ver e revisar</a>
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="biblioteca" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><FolderOpen className="w-4 h-4" /> Biblioteca</CardTitle></CardHeader>
              <CardContent>
                {libraryAssets.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Nenhum material enviado ainda.</p>
                ) : (
                  <div className="divide-y">
                    {libraryAssets.map(a => {
                      const status = LIBRARY_STATUS_LABEL[a.status] || LIBRARY_STATUS_LABEL.pendente
                      return (
                        <div key={a.id} className="flex items-center justify-between py-2.5 text-sm gap-3">
                          <div className="min-w-0">
                            <span className="font-medium truncate block">{a.title}</span>
                            <span className="text-xs text-muted-foreground">{LIBRARY_KIND_LABEL[a.kind]} · v{a.version}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline" className={status.className}>{status.label}</Badge>
                            <Button size="sm" variant="outline" onClick={() => handleOpenAsset(a)} disabled={openingAssetId === a.id}>
                              {openingAssetId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Ver e revisar'}
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="conversoes" className="mt-4">
            <PortalConversionsCard contatoId={contatoId} initial={conversions} />
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

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background p-3 space-y-1">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
      <div className="text-lg font-bold tabular-nums">{value}</div>
    </div>
  )
}
