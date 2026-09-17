'use client'

import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileBarChart, FileDown, Loader2, FileText } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import ClientFunnelCard from '@/components/features/agencias-trafego/ClientFunnelCard'
import ClientCampaignsTable from '@/components/features/agencias-trafego/ClientCampaignsTable'
import ClientHistorySection from '@/components/features/agencias-trafego/ClientHistorySection'
import ClientReportPrintView from '@/components/features/agencias-trafego/ClientReportPrintView'
import { listClientReports, saveClientReportPdf, type ClientReport } from '@/actions/client-reports'
import { getObjectSignedUrl } from '@/actions/storage-read'
import type { ClientPerformanceSummary } from '@/actions/trafego-performance'
import type { ClientTrackingFunnel } from '@/actions/trafego-tracking'
import type { TrafficActivity } from '@/actions/trafego-history'

type CampaignRow = {
  id: string
  name: string
  objective: string | null
  status: string
  ad_accounts: { name: string; provider: string } | null
  metrics: { impressions: number; clicks: number; spend_cents: number; leads: number }
}
type SaleRow = { id: string; sale_date: string | null; amount_cents: number | null; status: string; products: { name: string } | null }

function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) return curr === 0 ? 0 : null
  return ((curr - prev) / prev) * 100
}

/**
 * Relatório do período — resumo executivo + comparativo, montado a partir
 * de dados já buscados pra outras abas (Analytics, Estratégia, Histórico),
 * com geração de PDF (mesmo padrão html2canvas+jsPDF de
 * PlanoContratoManagerDialog) e histórico de relatórios já gerados
 * (reaproveita a Storage Service genérica — actions/client-reports.ts).
 * A IA de insights (Marketing Strategist) fica pra próxima fase — o
 * resumo aqui só compõe números reais, nunca inventa métrica ausente.
 */
export default function ClientReportsTab({
  orgSlug, clientId, clientName, orgName,
  current, previous, funnel, hasFunnelData, campaigns, sales, activities,
}: {
  orgSlug: string
  clientId: string
  clientName: string
  orgName: string
  current: ClientPerformanceSummary
  previous: ClientPerformanceSummary
  funnel: ClientTrackingFunnel
  hasFunnelData: boolean
  campaigns: CampaignRow[]
  sales: SaleRow[]
  activities: TrafficActivity[]
}) {
  const [reports, setReports] = useState<ClientReport[]>([])
  const [loadingReports, setLoadingReports] = useState(true)
  const [generating, setGenerating] = useState(false)
  const captureRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listClientReports(orgSlug, clientId).then(r => { setReports(r); setLoadingReports(false) })
  }, [orgSlug, clientId])

  const investChange = pctChange(current.investmentCents, previous.investmentCents)
  const leadsChange = pctChange(current.leads, previous.leads)
  const revenueChange = pctChange(current.revenueCents, previous.revenueCents)

  const periodEnd = new Date()
  const periodStart = new Date(periodEnd.getTime() - 29 * 86_400_000)
  const periodLabel = `${periodStart.toLocaleDateString('pt-BR')} a ${periodEnd.toLocaleDateString('pt-BR')}`

  async function handleGeneratePdf() {
    setGenerating(true)
    try {
      const container = captureRef.current
      flushSync(() => {})
      await new Promise(resolve => setTimeout(resolve, 300))
      const target = container?.querySelector('.max-w-\\[210mm\\].bg-white') as HTMLElement | null
      if (!target) throw new Error('Não foi possível localizar o conteúdo do relatório.')

      const html2canvas = (await import('html2canvas')).default
      const { jsPDF } = await import('jspdf')

      const canvas = await html2canvas(target, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
      const pageWidth = 210
      const pageHeight = 297
      const imgWidth = pageWidth
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      let heightLeft = imgHeight
      let position = 0
      const imgData = canvas.toDataURL('image/jpeg', 0.92)
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
      while (heightLeft > 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      const base64 = pdf.output('datauristring').split(',')[1]
      const res = await saveClientReportPdf(orgSlug, clientId, base64, {
        start: periodStart.toISOString().slice(0, 10),
        end: periodEnd.toISOString().slice(0, 10),
      })
      if (!res.ok) { toast.error(res.error); return }
      toast.success('Relatório em PDF gerado.')
      setReports(await listClientReports(orgSlug, clientId))
    } catch (e: any) {
      toast.error(e.message || 'Erro ao gerar PDF do relatório.')
    } finally {
      setGenerating(false)
    }
  }

  async function handleDownload(reportId: string) {
    const res = await getObjectSignedUrl(orgSlug, reportId, { download: true })
    if (!res.ok) { toast.error(res.error); return }
    window.open(res.url, '_blank')
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2"><FileBarChart className="w-4 h-4" /> Resumo executivo (30 dias)</CardTitle>
          <Button size="sm" variant="outline" onClick={handleGeneratePdf} disabled={generating}>
            {generating ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5 mr-1.5" />}
            Gerar PDF
          </Button>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Investimento de {formatCurrency(current.investmentCents)}
            {investChange != null && ` (${investChange >= 0 ? '+' : ''}${investChange.toFixed(0)}% vs. período anterior)`},
            {' '}gerando {current.leads} leads
            {leadsChange != null && ` (${leadsChange >= 0 ? '+' : ''}${leadsChange.toFixed(0)}%)`}.
          </p>
          <p>
            Receita atribuída de {formatCurrency(current.revenueCents)}
            {revenueChange != null && ` (${revenueChange >= 0 ? '+' : ''}${revenueChange.toFixed(0)}% vs. período anterior)`}.
            {' '}ROAS: {current.roas != null ? `${current.roas.toFixed(1)}x` : '— (dados comerciais insuficientes para calcular)'}.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><FileText className="w-4 h-4" /> Relatórios gerados</CardTitle></CardHeader>
        <CardContent>
          {loadingReports ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : reports.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum relatório em PDF gerado ainda.</p>
          ) : (
            <div className="divide-y">
              {reports.map(r => (
                <div key={r.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <div className="font-medium">{r.period_start && r.period_end ? `${r.period_start} a ${r.period_end}` : r.filename}</div>
                    <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString('pt-BR')}</div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => handleDownload(r.id)}>Baixar</Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ClientFunnelCard funnel={funnel} hasData={hasFunnelData} title="Funil do período" />
      <ClientCampaignsTable campaigns={campaigns} />
      <ClientHistorySection sales={sales} activities={activities} />

      <div ref={captureRef} style={{ position: 'fixed', left: -10000, top: 0, width: 900, pointerEvents: 'none' }} aria-hidden>
        <ClientReportPrintView
          clientName={clientName}
          orgName={orgName}
          periodLabel={periodLabel}
          current={current}
          previous={previous}
          funnel={funnel}
          campaigns={campaigns.map(c => ({ id: c.id, name: c.name, status: c.status, metrics: c.metrics }))}
        />
      </div>
    </div>
  )
}
