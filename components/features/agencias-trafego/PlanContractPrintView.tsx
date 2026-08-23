'use client'

import { Button } from '@/components/ui/button'
import { Printer, ArrowLeft } from 'lucide-react'

type OrgBranding = {
  name: string
  logo_url: string | null
  primary_color: string | null
  cnpj: string | null
  cadastur: string | null
  contact_phone: string | null
  contact_email: string | null
  address_street: string | null
}

type PlanoSale = {
  id: string
  client_name: string
  plano: string
  valor_mensal_cents: number
  duracao_meses: number | null
  data_inicio: string | null
  data_fim: string | null
  forma_pagamento: string | null
}

function fmtDate(d?: string | null) {
  return d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'
}
function fmtCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}

/**
 * Contrato de assinatura de plano (Agências de Tráfego) — usado tanto pra
 * capturar o PDF (ContratoManagerDialog, sem template) quanto pra renderizar
 * um template customizado (bodyHtml). Mesma estrutura visual de
 * ContractPrintView/ContractTemplatePrintView (Viagens), sem o botão de
 * anexar assinado manualmente (vouchers é específico de travel_sales).
 */
export default function PlanContractPrintView({
  sale, org, bodyHtml,
}: { sale: PlanoSale; org: OrgBranding; bodyHtml?: string }) {
  const accent = org.primary_color || '#0f62fe'
  const today = new Date().toLocaleDateString('pt-BR')

  return (
    <div className="min-h-screen bg-muted/30 py-8 print:bg-white print:py-0">
      <div className="max-w-[210mm] mx-auto print:hidden mb-4 px-4 flex items-center justify-between gap-2">
        <a href={`/app`} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 shrink-0" onClick={e => { e.preventDefault(); window.close() }}>
          <ArrowLeft className="w-3 h-3" /> Fechar
        </a>
        <Button onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-1.5" /> Imprimir / Salvar PDF
        </Button>
      </div>

      <div className="max-w-[210mm] mx-auto bg-white text-black shadow-sm print:shadow-none p-10 print:p-8 min-h-[297mm] text-sm leading-relaxed">
        <div className="flex items-center gap-3 border-b-2 pb-4 mb-6 break-inside-avoid" style={{ borderColor: accent }}>
          {org.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logo_url} alt={org.name} className="h-12 w-auto object-contain" />
          )}
          <div>
            <p className="text-base font-bold">{org.name}</p>
            <p className="text-[11px] text-gray-500">
              {org.cnpj && <>CNPJ {org.cnpj}</>}
              {org.cnpj && org.cadastur && ' · '}
              {org.cadastur && <>CADASTUR {org.cadastur}</>}
            </p>
          </div>
        </div>

        {bodyHtml ? (
          <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
        ) : (
          <>
            <h1 className="text-lg font-bold text-center mb-6">Contrato de Prestação de Serviços</h1>
            <p className="mb-4">
              Pelo presente instrumento, <strong>{org.name}</strong>
              {org.cnpj && <>, CNPJ {org.cnpj}</>}, doravante CONTRATADA, e <strong>{sale.client_name}</strong>,
              doravante CONTRATANTE, ajustam a prestação do serviço abaixo descrito.
            </p>
            <table className="w-full border-collapse mb-6">
              <tbody>
                <tr className="border-b"><td className="py-1.5 font-medium">Plano</td><td className="py-1.5">{sale.plano}</td></tr>
                <tr className="border-b"><td className="py-1.5 font-medium">Mensalidade</td><td className="py-1.5">{fmtCurrency(sale.valor_mensal_cents)}</td></tr>
                <tr className="border-b"><td className="py-1.5 font-medium">Duração</td><td className="py-1.5">{sale.duracao_meses ? `${sale.duracao_meses} meses` : '—'}</td></tr>
                <tr className="border-b"><td className="py-1.5 font-medium">Início</td><td className="py-1.5">{fmtDate(sale.data_inicio)}</td></tr>
                <tr className="border-b"><td className="py-1.5 font-medium">Término previsto</td><td className="py-1.5">{fmtDate(sale.data_fim)}</td></tr>
                <tr><td className="py-1.5 font-medium">Forma de pagamento</td><td className="py-1.5 capitalize">{sale.forma_pagamento || '—'}</td></tr>
              </tbody>
            </table>
          </>
        )}

        <div className="grid grid-cols-2 gap-8 mt-16 break-inside-avoid">
          <div className="text-center">
            <div className="border-t border-black pt-2">
              <p className="text-xs">{sale.client_name}</p>
              <p className="text-[10px] text-gray-500">Contratante</p>
            </div>
          </div>
          <div className="text-center">
            <div className="border-t border-black pt-2">
              <p className="text-xs">{org.name}</p>
              <p className="text-[10px] text-gray-500">Contratada</p>
            </div>
          </div>
        </div>

        <p className="text-[10px] text-gray-400 text-center mt-10">Documento gerado em {today}</p>
      </div>
    </div>
  )
}
