import { formatCurrency } from '@/lib/utils'
import type { ClientPerformanceSummary } from '@/actions/trafego-performance'
import type { ClientTrackingFunnel } from '@/actions/trafego-tracking'

type CampaignRow = { id: string; name: string; status: string; metrics: { impressions: number; clicks: number; spend_cents: number; leads: number } }

/** Versão impressa do relatório do cliente — capturada via html2canvas+jsPDF
 *  (mesmo padrão de PlanContractPrintView). Nunca inventa métrica ausente:
 *  ROAS/CAC mostram "—" quando não há dado comercial suficiente. */
export default function ClientReportPrintView({
  clientName, orgName, periodLabel, current, previous, funnel, campaigns,
}: {
  clientName: string
  orgName: string
  periodLabel: string
  current: ClientPerformanceSummary
  previous: ClientPerformanceSummary
  funnel: ClientTrackingFunnel
  campaigns: CampaignRow[]
}) {
  return (
    <div className="max-w-[210mm] bg-white text-black p-10 mx-auto" style={{ fontFamily: 'Arial, sans-serif' }}>
      <div className="flex items-center justify-between border-b pb-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">{clientName}</h1>
          <p className="text-sm text-gray-500">Relatório de performance — {periodLabel}</p>
        </div>
        <div className="text-right text-xs text-gray-500">{orgName}</div>
      </div>

      <h2 className="text-sm font-bold uppercase text-gray-500 mb-2">Resumo executivo</h2>
      <div className="grid grid-cols-4 gap-3 mb-6">
        <Metric label="Investimento" value={formatCurrency(current.investmentCents)} />
        <Metric label="Leads" value={String(current.leads)} />
        <Metric label="CPL" value={current.cplCents != null ? formatCurrency(current.cplCents) : '—'} />
        <Metric label="Conversões" value={String(current.salesCount)} />
        <Metric label="Receita" value={formatCurrency(current.revenueCents)} />
        <Metric label="ROAS" value={current.roas != null ? `${current.roas.toFixed(1)}x` : '—'} />
        <Metric label="CAC" value={current.cpaCents != null ? formatCurrency(current.cpaCents) : '—'} />
        <Metric label="Cliques" value={current.clicks.toLocaleString('pt-BR')} />
      </div>

      <h2 className="text-sm font-bold uppercase text-gray-500 mb-2">Comparativo com período anterior</h2>
      <table className="w-full text-sm mb-6 border-collapse">
        <thead>
          <tr className="border-b"><th className="text-left py-1.5">Métrica</th><th className="text-right py-1.5">Anterior</th><th className="text-right py-1.5">Atual</th></tr>
        </thead>
        <tbody>
          <tr className="border-b"><td className="py-1.5">Investimento</td><td className="text-right">{formatCurrency(previous.investmentCents)}</td><td className="text-right">{formatCurrency(current.investmentCents)}</td></tr>
          <tr className="border-b"><td className="py-1.5">Leads</td><td className="text-right">{previous.leads}</td><td className="text-right">{current.leads}</td></tr>
          <tr className="border-b"><td className="py-1.5">Receita</td><td className="text-right">{formatCurrency(previous.revenueCents)}</td><td className="text-right">{formatCurrency(current.revenueCents)}</td></tr>
        </tbody>
      </table>

      <h2 className="text-sm font-bold uppercase text-gray-500 mb-2">Funil</h2>
      <div className="grid grid-cols-5 gap-2 mb-6 text-center text-xs">
        <FunnelStep label="Investimento" value={formatCurrency(funnel.investmentCents)} />
        <FunnelStep label="Cliques" value={funnel.clicks.toLocaleString('pt-BR')} />
        <FunnelStep label="Leads" value={funnel.leads.toLocaleString('pt-BR')} />
        <FunnelStep label="Vendas" value={funnel.sales.toLocaleString('pt-BR')} />
        <FunnelStep label="Receita" value={formatCurrency(funnel.revenueCents)} />
      </div>

      <h2 className="text-sm font-bold uppercase text-gray-500 mb-2">Campanhas</h2>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b"><th className="text-left py-1.5">Campanha</th><th className="text-left py-1.5">Status</th><th className="text-right py-1.5">Invest.</th><th className="text-right py-1.5">Leads</th></tr>
        </thead>
        <tbody>
          {campaigns.length === 0 ? (
            <tr><td colSpan={4} className="py-3 text-center text-gray-400">Nenhuma campanha no período.</td></tr>
          ) : campaigns.map(c => (
            <tr key={c.id} className="border-b">
              <td className="py-1.5">{c.name}</td>
              <td className="py-1.5">{c.status}</td>
              <td className="text-right">{formatCurrency(c.metrics.spend_cents)}</td>
              <td className="text-right">{c.metrics.leads}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="text-[10px] text-gray-400 mt-8">Gerado automaticamente pelo Althos CRM em {new Date().toLocaleDateString('pt-BR')}.</p>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded p-2">
      <div className="text-[9px] uppercase text-gray-400">{label}</div>
      <div className="text-base font-bold">{value}</div>
    </div>
  )
}
function FunnelStep({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded p-2">
      <div className="text-gray-400">{label}</div>
      <div className="font-bold">{value}</div>
    </div>
  )
}
