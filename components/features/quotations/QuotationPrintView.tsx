'use client'

import { Button } from '@/components/ui/button'
import { Printer, ArrowLeft, Check, X } from 'lucide-react'

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

type Lodging = {
  name: string
  check_in: string | null
  check_out: string | null
  room_category: string | null
  board: string | null
}

type Flight = {
  leg_type: string
  from_code: string | null
  from_city: string | null
  to_code: string | null
  to_city: string | null
  airline: string | null
  date: string | null
  duration_label: string | null
  stopover_label: string | null
  cabin_class: string | null
}

type Quotation = {
  id: string
  title: string | null
  client_name: string | null
  destinations: { name: string; country?: string | null }[] | null
  origin_label: string | null
  start_date: string | null
  end_date: string | null
  pax_adults: number | null
  pax_children: number | null
  occupancy_label: string | null
  price_per_person_cents: number | null
  total_cents: number | null
  payment_conditions: { label: string; value?: string | null }[] | null
  price_disclaimer: string | null
  included: string[] | null
  not_included: string[] | null
  cancellation_html: string | null
  flights_html: string | null
}

function fmtDate(d?: string | null) {
  return d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'
}
function fmtCurrency(cents: number | null | undefined) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}
function stripHtml(html?: string | null) {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function SectionRule() {
  return <div className="border-t border-gray-300 my-4" />
}

export default function QuotationPrintView({
  quotation, lodgings, flights, org,
}: {
  quotation: Quotation
  lodgings: Lodging[]
  flights: Flight[]
  org: OrgBranding
}) {
  const accent = org.primary_color || '#0f62fe'
  const destinations = (quotation.destinations || []).map(d => d.name).filter(Boolean).join(', ')
  const paxLine = `Adulto(s): ${quotation.pax_adults ?? 0} | Criança(s): ${quotation.pax_children ?? 0}`
  const idas = flights.filter(f => f.leg_type === 'outbound')
  const voltas = flights.filter(f => f.leg_type === 'inbound')
  const conexoes = flights.filter(f => f.leg_type === 'connection')
  const legGroups = [
    { label: 'Ida', legs: idas }, { label: 'Volta', legs: voltas }, { label: 'Conexão', legs: conexoes },
  ].filter(g => g.legs.length > 0)
  const cancellationText = stripHtml(quotation.cancellation_html)
  const flightsHtmlText = stripHtml(quotation.flights_html)

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
        <div className="pb-4">
          <div className="flex items-center gap-3">
            {org.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logo_url} alt={org.name} className="h-14 w-auto object-contain" />
            )}
            <p className="text-2xl font-bold" style={{ color: accent }}>{org.name}</p>
          </div>
        </div>
        <div className="border-t-2 pt-2 pb-4 flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-500" style={{ borderColor: accent }}>
          {org.cnpj && <span>CNPJ {org.cnpj}</span>}
          {org.cadastur && <span>CADASTUR {org.cadastur}</span>}
          {org.contact_phone && <span>{org.contact_phone}</span>}
          {org.contact_email && <span>{org.contact_email}</span>}
          {org.website && <span>{org.website}</span>}
        </div>

        <div className="border-2 border-green-600 p-4 mb-6">
          <p className="font-bold text-red-600 mb-1">Atenção!!</p>
          <p className="text-[13px] leading-relaxed">
            Esta é uma simples cotação. Nenhum dos componentes selecionados está confirmado até que
            seja efetivada a reserva. Os valores podem sofrer alterações em virtude de
            disponibilidade e câmbio.
          </p>
        </div>

        <p className="text-lg mb-6" style={{ color: accent }}>
          Código da Cotação: <span className="font-bold text-black">#{quotation.id.slice(0, 8).toUpperCase()}</span>
        </p>

        <div className="border-2 p-4 mb-8" style={{ borderColor: accent }}>
          <div className="flex items-center justify-between text-gray-400 text-[12px] border-b pb-2 mb-3">
            <span>Agência Emissora</span>
            <span>Total da compra</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-bold text-gray-600 uppercase">{org.name}</span>
            <span className="font-bold text-gray-600 text-lg tabular-nums">{fmtCurrency(quotation.total_cents)}</span>
          </div>
        </div>

        <p className="text-[13px] mb-1" style={{ color: accent }}>Dados da Cotação:</p>
        <SectionRule />

        <p className="text-xl mb-1" style={{ color: accent }}>
          {quotation.client_name ? `Cliente: ${quotation.client_name}` : (quotation.title || 'Cotação')}
        </p>
        {destinations && <p className="text-[13px] mb-2">Destino: {destinations}{quotation.origin_label ? ` · Saindo de ${quotation.origin_label}` : ''}</p>}
        {quotation.start_date && (
          <p className="text-[13px]">Período: {fmtDate(quotation.start_date)} - {fmtDate(quotation.end_date)}</p>
        )}
        <p className="text-[13px]">{paxLine}{quotation.occupancy_label ? ` · ${quotation.occupancy_label}` : ''}</p>
        <SectionRule />

        {lodgings.map((l, i) => (
          <div key={i}>
            <p className="font-bold text-[13px] mb-2">Hotel: {l.name}</p>
            <p className="text-[13px]">Check-in: {fmtDate(l.check_in)} | Check-out: {fmtDate(l.check_out)}</p>
            {(l.room_category || l.board) && (
              <p className="text-[13px]">{[l.room_category, l.board].filter(Boolean).join(' · ')}</p>
            )}
            <SectionRule />
          </div>
        ))}

        {legGroups.length > 0 && (
          <>
            <p className="font-bold text-[13px] mb-2">
              Voo{quotation.start_date ? ` (${fmtDate(quotation.start_date)} - ${fmtDate(quotation.end_date)})` : ''}
            </p>
            {legGroups.map(group => (
              <div key={group.label} className="mb-3">
                {group.legs.map((f, i) => (
                  <div key={i} className="mb-2.5">
                    <p className="font-bold text-[13px]">{group.label}</p>
                    <p className="text-[13px]">
                      {[f.from_city || f.from_code, f.to_city || f.to_code].filter(Boolean).join(' - ') || '—'}
                    </p>
                    {f.airline && <p className="text-[13px]">{f.airline}</p>}
                    <p className="text-[13px]"><span className="font-bold">Data:</span> {fmtDate(f.date)}{f.duration_label ? ` · ${f.duration_label}` : ''}</p>
                    {f.stopover_label && <p className="text-[13px] text-gray-500">{f.stopover_label}</p>}
                  </div>
                ))}
              </div>
            ))}
            <SectionRule />
          </>
        )}

        {flightsHtmlText && legGroups.length === 0 && (
          <>
            <p className="font-bold text-[13px] mb-2">Aéreo</p>
            <p className="text-[13px] whitespace-pre-wrap">{flightsHtmlText}</p>
            <SectionRule />
          </>
        )}

        {((quotation.included?.length ?? 0) > 0 || (quotation.not_included?.length ?? 0) > 0) && (
          <>
            <div className="grid grid-cols-2 gap-4 mb-2">
              <div>
                <p className="font-bold text-[13px] mb-1.5">Incluso</p>
                {!quotation.included?.length ? <p className="text-xs text-gray-400">—</p> : (
                  <ul className="space-y-1">
                    {quotation.included.map((item, i) => (
                      <li key={i} className="text-[13px] flex items-center gap-1.5"><Check className="w-3 h-3 text-green-600 shrink-0" /> {item}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="font-bold text-[13px] mb-1.5">Não incluso</p>
                {!quotation.not_included?.length ? <p className="text-xs text-gray-400">—</p> : (
                  <ul className="space-y-1">
                    {quotation.not_included.map((item, i) => (
                      <li key={i} className="text-[13px] flex items-center gap-1.5"><X className="w-3 h-3 text-gray-400 shrink-0" /> {item}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <SectionRule />
          </>
        )}

        {quotation.price_per_person_cents != null && quotation.price_per_person_cents > 0 && (
          <p className="text-[13px] mb-2"><span className="font-bold">Valor por pessoa:</span> <span className="tabular-nums">{fmtCurrency(quotation.price_per_person_cents)}</span></p>
        )}
        {(quotation.payment_conditions?.length ?? 0) > 0 && (
          <div className="mb-4">
            <p className="font-bold text-[13px] mb-1.5">Condições de pagamento</p>
            <ul className="space-y-1">
              {quotation.payment_conditions!.map((p, i) => (
                <li key={i} className="text-[13px]">• {p.label}{p.value ? ` — ${p.value}` : ''}</li>
              ))}
            </ul>
          </div>
        )}

        {quotation.price_disclaimer && (
          <p className="text-[11px] text-gray-500 mb-4 whitespace-pre-wrap">{quotation.price_disclaimer}</p>
        )}

        {cancellationText && (
          <div className="mb-4">
            <p className="font-bold text-[13px] mb-1">Política de cancelamento</p>
            <p className="text-[13px] whitespace-pre-wrap">{cancellationText}</p>
          </div>
        )}

        <div className="text-[12px] text-gray-500 space-y-2 text-center">
          {(org.contact_email || org.contact_phone) && (
            <p>
              Em caso de dúvidas entre em contato
              {org.contact_email ? ` pelo email ${org.contact_email}` : ''}
              {org.contact_email && org.contact_phone ? ' ou' : ''}
              {org.contact_phone ? ` pelo telefone ${org.contact_phone}` : ''}.
            </p>
          )}
          {org.website && (
            <p>Acesse <span style={{ color: accent }}>{org.website}</span> ou consulte seu agente de viagens</p>
          )}
          <p className="pt-2 text-[10px] text-gray-400">
            {org.name}{org.cnpj ? ` — CNPJ ${org.cnpj}` : ''}{org.cadastur ? ` — CADASTUR ${org.cadastur}` : ''}
          </p>
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
