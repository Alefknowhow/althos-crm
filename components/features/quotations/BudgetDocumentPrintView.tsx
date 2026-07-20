'use client'

import { Button } from '@/components/ui/button'
import { Printer, ArrowLeft, Check, X } from 'lucide-react'
import type { BudgetDocumentRow } from '@/actions/budget-documents'

type OrgBranding = {
  name: string
  logo_url: string | null
  primary_color: string | null
  cnpj: string | null
  cadastur: string | null
  contact_phone: string | null
  contact_email: string | null
  website: string | null
}

function fmtDate(d?: string | null) {
  return d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'
}
function fmtCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}

export default function BudgetDocumentPrintView({ doc, org }: { doc: BudgetDocumentRow; org: OrgBranding }) {
  const accent = org.primary_color || '#0f62fe'
  const validUntil = new Date(new Date(doc.created_at).getTime() + doc.validity_days * 86400000)

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

      <div className="max-w-[210mm] mx-auto bg-white text-black shadow-sm print:shadow-none p-10 print:p-8 min-h-[297mm] text-sm">
        {/* Cabeçalho institucional */}
        <div className="flex items-start justify-between gap-4 border-b-2 pb-6 mb-6" style={{ borderColor: accent }}>
          <div className="flex items-center gap-3">
            {org.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logo_url} alt={org.name} className="h-14 w-auto object-contain" />
            )}
            <div>
              <p className="text-lg font-bold">{org.name}</p>
              <p className="text-[11px] text-gray-500">
                {org.cnpj && <>CNPJ {org.cnpj}</>}
                {org.cnpj && org.cadastur && ' · '}
                {org.cadastur && <>CADASTUR {org.cadastur}</>}
              </p>
              <p className="text-[11px] text-gray-500">
                {[org.contact_phone, org.contact_email, org.website].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Orçamento de viagem</p>
            <p className="text-sm font-semibold" style={{ color: accent }}>#{doc.id.slice(0, 8).toUpperCase()}</p>
            <p className="text-[11px] text-gray-500 mt-1">Emitido em {fmtDate(doc.created_at.slice(0, 10))}</p>
          </div>
        </div>

        {/* Dados do cliente */}
        <table className="w-full border-collapse mb-6">
          <tbody>
            <tr>
              <td className="border px-3 py-2 bg-gray-50 font-semibold w-1/4">Cliente</td>
              <td className="border px-3 py-2" colSpan={3}>{doc.client_name || '—'}</td>
            </tr>
            <tr>
              <td className="border px-3 py-2 bg-gray-50 font-semibold">Destino</td>
              <td className="border px-3 py-2">{doc.destination || '—'}</td>
              <td className="border px-3 py-2 bg-gray-50 font-semibold w-1/6">Hotel</td>
              <td className="border px-3 py-2">{doc.hotel_name || '—'}</td>
            </tr>
            <tr>
              <td className="border px-3 py-2 bg-gray-50 font-semibold">Período</td>
              <td className="border px-3 py-2">{fmtDate(doc.start_date)} — {fmtDate(doc.end_date)}</td>
              <td className="border px-3 py-2 bg-gray-50 font-semibold">Passageiros</td>
              <td className="border px-3 py-2">
                {doc.pax_adults ?? '—'} adulto(s){doc.pax_children ? `, ${doc.pax_children} criança(s)` : ''}
              </td>
            </tr>
            <tr>
              <td className="border px-3 py-2 bg-gray-50 font-semibold">Operadora</td>
              <td className="border px-3 py-2" colSpan={3}>{doc.operadora || '—'}</td>
            </tr>
          </tbody>
        </table>

        {/* Incluso / não incluso */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-1.5">Incluso</p>
            {doc.included.length === 0 ? <p className="text-xs text-gray-400">—</p> : (
              <ul className="space-y-1">
                {doc.included.map((item, i) => (
                  <li key={i} className="text-xs flex items-center gap-1.5"><Check className="w-3 h-3 text-green-600 shrink-0" /> {item}</li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-1.5">Não incluso</p>
            {doc.not_included.length === 0 ? <p className="text-xs text-gray-400">—</p> : (
              <ul className="space-y-1">
                {doc.not_included.map((item, i) => (
                  <li key={i} className="text-xs flex items-center gap-1.5"><X className="w-3 h-3 text-gray-400 shrink-0" /> {item}</li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Valores */}
        <table className="w-full border-collapse mb-6">
          <thead>
            <tr>
              <th className="border px-3 py-2 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">Item</th>
              <th className="border px-3 py-2 bg-gray-50 text-right text-xs uppercase tracking-wide text-gray-500">Valor</th>
            </tr>
          </thead>
          <tbody>
            {doc.price_per_person_cents != null && doc.price_per_person_cents > 0 && (
              <tr>
                <td className="border px-3 py-2">Valor por pessoa</td>
                <td className="border px-3 py-2 text-right tabular-nums">{fmtCurrency(doc.price_per_person_cents)}</td>
              </tr>
            )}
            <tr>
              <td className="border px-3 py-2 font-semibold">Valor total</td>
              <td className="border px-3 py-2 text-right tabular-nums font-bold" style={{ color: accent }}>{fmtCurrency(doc.total_cents)}</td>
            </tr>
          </tbody>
        </table>

        {/* Condições de pagamento */}
        {doc.payment_conditions.length > 0 && (
          <div className="mb-6">
            <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-1.5">Condições de pagamento</p>
            <ul className="space-y-1">
              {doc.payment_conditions.map((p, i) => (
                <li key={i} className="text-xs">• {p.label}</li>
              ))}
            </ul>
          </div>
        )}

        {doc.observacoes && (
          <div className="mb-6">
            <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-1">Observações</p>
            <p className="text-xs whitespace-pre-wrap">{doc.observacoes}</p>
          </div>
        )}

        <div className="rounded-lg border-2 p-3 text-center text-xs font-medium" style={{ borderColor: accent, color: accent }}>
          Orçamento válido até {validUntil.toLocaleDateString('pt-BR')} ({doc.validity_days} dias a partir da emissão)
        </div>

        <div className="mt-10 pt-4 border-t text-center text-[10px] text-gray-400">
          {org.name}{org.cnpj ? ` — CNPJ ${org.cnpj}` : ''}{org.cadastur ? ` — CADASTUR ${org.cadastur}` : ''}
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
