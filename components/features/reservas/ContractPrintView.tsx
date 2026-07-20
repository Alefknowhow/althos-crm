'use client'

import { Button } from '@/components/ui/button'
import { Printer, ArrowLeft } from 'lucide-react'
import type { TravelSaleRow } from '@/actions/travel-sales'

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

function fmtDate(d?: string | null) {
  return d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'
}
function fmtCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}

export default function ContractPrintView({ sale, org }: { sale: TravelSaleRow; org: OrgBranding }) {
  const accent = org.primary_color || '#0f62fe'
  const today = new Date().toLocaleDateString('pt-BR')

  return (
    <div className="min-h-screen bg-muted/30 py-8 print:bg-white print:py-0">
      <div className="max-w-[210mm] mx-auto print:hidden mb-4 px-4 flex items-center justify-between">
        <a href={`/app`} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1" onClick={e => { e.preventDefault(); window.close() }}>
          <ArrowLeft className="w-3 h-3" /> Fechar
        </a>
        <Button onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-1.5" /> Imprimir / Salvar PDF
        </Button>
      </div>

      <div className="max-w-[210mm] mx-auto bg-white text-black shadow-sm print:shadow-none p-10 print:p-8 min-h-[297mm] text-sm leading-relaxed">
        <div className="flex items-center gap-3 border-b-2 pb-4 mb-6" style={{ borderColor: accent }}>
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

        <h1 className="text-lg font-bold text-center mb-1">Contrato de Prestação de Serviços de Viagem</h1>
        <p className="text-center text-xs text-gray-500 mb-6">#{sale.id.slice(0, 8).toUpperCase()} — {today}</p>

        {/* Partes */}
        <table className="w-full border-collapse mb-6">
          <tbody>
            <tr>
              <td className="border px-3 py-2 bg-gray-50 font-semibold w-1/4">Contratada</td>
              <td className="border px-3 py-2">
                {org.name}{org.address_street ? `, ${org.address_street}` : ''}
                {(org.contact_phone || org.contact_email) && (
                  <> — {[org.contact_phone, org.contact_email].filter(Boolean).join(' · ')}</>
                )}
              </td>
            </tr>
            <tr>
              <td className="border px-3 py-2 bg-gray-50 font-semibold">Contratante</td>
              <td className="border px-3 py-2">{sale.client_name || '—'}</td>
            </tr>
          </tbody>
        </table>

        {/* Objeto */}
        <div className="mb-6">
          <p className="font-semibold mb-2">1. Objeto do contrato</p>
          <p>
            O presente contrato tem como objeto a prestação de serviços de intermediação de viagem
            pela CONTRATADA em favor da CONTRATANTE, compreendendo o pacote com destino a{' '}
            <strong>{sale.destination || '—'}</strong>, com hospedagem em{' '}
            <strong>{sale.hotel_name || '—'}</strong>, no período de{' '}
            <strong>{fmtDate(sale.departure_date)}</strong> a <strong>{fmtDate(sale.return_date)}</strong>
            {sale.airline && <>, com transporte aéreo pela companhia <strong>{sale.airline}</strong></>}
            {sale.operator && <>, operado por <strong>{sale.operator}</strong></>}.
          </p>
        </div>

        {/* Valor e pagamento */}
        <table className="w-full border-collapse mb-6">
          <tbody>
            <tr>
              <td className="border px-3 py-2 bg-gray-50 font-semibold w-1/4">Valor total</td>
              <td className="border px-3 py-2 font-bold" style={{ color: accent }}>{fmtCurrency(sale.total_cents)}</td>
            </tr>
            <tr>
              <td className="border px-3 py-2 bg-gray-50 font-semibold">Forma de pagamento</td>
              <td className="border px-3 py-2">{sale.payment_method || '—'}</td>
            </tr>
            {sale.package_locator && (
              <tr>
                <td className="border px-3 py-2 bg-gray-50 font-semibold">Localizador do pacote</td>
                <td className="border px-3 py-2 font-mono">{sale.package_locator}</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Cláusula de cancelamento */}
        <div className="mb-6">
          <p className="font-semibold mb-2">2. Cancelamento e reembolso</p>
          <p>
            Eventuais cancelamentos, alterações ou reembolsos seguirão as políticas específicas da
            operadora e/ou companhia aérea responsáveis pelos serviços contratados, podendo incidir
            multas e taxas conforme normas vigentes à época da solicitação. A CONTRATADA atuará como
            intermediária junto aos fornecedores, não se responsabilizando por eventos alheios à sua
            vontade (caso fortuito ou força maior).
          </p>
        </div>

        {sale.notes && (
          <div className="mb-6">
            <p className="font-semibold mb-2">3. Observações</p>
            <p className="whitespace-pre-wrap">{sale.notes}</p>
          </div>
        )}

        {/* Assinaturas */}
        <div className="grid grid-cols-2 gap-8 mt-16">
          <div className="text-center">
            <div className="border-t border-black pt-2">
              <p className="font-semibold">{org.name}</p>
              <p className="text-xs text-gray-500">Contratada</p>
            </div>
          </div>
          <div className="text-center">
            <div className="border-t border-black pt-2">
              <p className="font-semibold">{sale.client_name || '—'}</p>
              <p className="text-xs text-gray-500">Contratante</p>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-4 border-t text-center text-[10px] text-gray-400">
          Documento gerado por {org.name} em {today}
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  )
}
