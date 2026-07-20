'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Printer, MapPin, Plane, Hotel, Car, ShieldCheck, ArrowLeft } from 'lucide-react'
import type { TravelSaleRow } from '@/actions/travel-sales'

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

export default function VoucherPrintView({ sale, org }: { sale: TravelSaleRow; org: OrgBranding }) {
  const accent = org.primary_color || '#0f62fe'
  const included: string[] = Array.isArray(sale.included_items) ? sale.included_items : []
  const hasTraslado = included.includes('transfer')
  const hasSeguro = included.includes('seguro')
  const qrData = sale.airline_checkin_url
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(sale.airline_checkin_url)}`
    : null

  return (
    <div className="min-h-screen bg-muted/30 py-8 print:bg-white print:py-0">
      <div className="max-w-[210mm] mx-auto print:hidden mb-4 px-4 flex items-center justify-between">
        <Link href={`/app`} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1" onClick={e => { e.preventDefault(); window.close() }}>
          <ArrowLeft className="w-3 h-3" /> Fechar
        </Link>
        <Button onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-1.5" /> Imprimir / Salvar PDF
        </Button>
      </div>

      <div className="max-w-[210mm] mx-auto bg-white text-black shadow-sm print:shadow-none p-10 print:p-8 min-h-[297mm]">
        {/* Cabeçalho da agência */}
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
            <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Voucher de viagem</p>
            <p className="text-sm font-semibold" style={{ color: accent }}>#{sale.id.slice(0, 8).toUpperCase()}</p>
          </div>
        </div>

        {/* Dados do cliente */}
        <div className="mb-6">
          <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-1">Cliente</p>
          <p className="text-base font-semibold">{sale.client_name || '—'}</p>
        </div>

        {/* Resumo da viagem */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 mt-0.5 shrink-0" style={{ color: accent }} />
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Destino</p>
              <p className="text-sm">{sale.destination || '—'}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Hotel className="w-4 h-4 mt-0.5 shrink-0" style={{ color: accent }} />
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Hospedagem</p>
              <p className="text-sm">{sale.hotel_name || '—'}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Plane className="w-4 h-4 mt-0.5 shrink-0" style={{ color: accent }} />
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Voos</p>
              <p className="text-sm">{sale.airline || '—'}</p>
              <p className="text-xs text-gray-500">{fmtDate(sale.departure_date)} → {fmtDate(sale.return_date)}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Car className="w-4 h-4 mt-0.5 shrink-0" style={{ color: accent }} />
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Serviços</p>
              <div className="flex gap-1.5 flex-wrap mt-0.5">
                {hasTraslado && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100">Traslado</span>}
                {hasSeguro && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 inline-flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Seguro viagem</span>}
                {!hasTraslado && !hasSeguro && <span className="text-sm text-gray-400">—</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Localizadores */}
        <div className="grid grid-cols-2 gap-4 mb-6 rounded-lg border p-4">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Operadora</p>
            <p className="text-sm">{sale.operator || '—'}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Localizador do pacote</p>
            <p className="text-sm font-mono">{sale.package_locator || '—'}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Localizador aéreo</p>
            <p className="text-sm font-mono">{sale.air_locator || '—'}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Forma de pagamento</p>
            <p className="text-sm">{sale.payment_method || '—'}</p>
          </div>
        </div>

        {sale.notes && (
          <div className="mb-6">
            <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-1">Observações</p>
            <p className="text-sm whitespace-pre-wrap">{sale.notes}</p>
          </div>
        )}

        {qrData && (
          <div className="flex flex-col items-center gap-2 mt-auto pt-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrData} alt="QR code de check-in" className="w-32 h-32" />
            <p className="text-[11px] text-gray-500">Aponte a câmera para acessar o check-in online</p>
          </div>
        )}

        <div className="mt-10 pt-4 border-t text-center text-[10px] text-gray-400">
          Documento gerado por {org.name} — apresente este voucher junto a um documento de identificação.
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
