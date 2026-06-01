'use client'

import { useState } from 'react'
import { Printer } from 'lucide-react'

type Org = {
  name: string | null
  logo_url: string | null
  cnpj: string | null
  cadastur: string | null
  contact_phone: string | null
  contact_email: string | null
  address_street: string | null
  address_city: string | null
  address_state: string | null
  address_zip: string | null
}

type Proposal = {
  title: string | null
  status: string
  start_date: string | null
  end_date: string | null
  client_name: string | null
  travelers: any[]
  travelers_note: string | null
  destinations: any[]
  flights: any[]
  hotels: any[]
  services: Record<string, any>
  included: string[]
  not_included: string[]
  order_bumps: any[]
  total_cents: number
  pax_count: number | null
  price_per_person_cents: number | null
  payment: Record<string, any>
  company_override: Record<string, any> | null
}

function brl(cents?: number | null) {
  return ((cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtDate(d?: string | null) {
  return d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—'
}

const SERVICE_LABELS: Record<string, string> = {
  transfer: 'Traslado',
  insurance: 'Seguro viagem',
  car_rental: 'Locação de carro',
}
const METHOD_LABELS: Record<string, string> = {
  pix: 'Pix', boleto: 'Boleto', cartao: 'Cartão',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="proposal-section">
      <h2 className="text-lg font-bold text-slate-800 border-b border-slate-200 pb-2 mb-4">{title}</h2>
      {children}
    </section>
  )
}

export default function PublicProposalView({ proposal, org }: { proposal: Proposal; org: Org }) {
  const [imgErr, setImgErr] = useState<Record<string, boolean>>({})
  const ov = proposal.company_override || {}
  const companyName = ov.name || org.name || 'Agência de Viagens'
  const logo = ov.logo_url || org.logo_url
  const cnpj = ov.cnpj || org.cnpj
  const cadastur = ov.cadastur || org.cadastur
  const phone = ov.contact_phone || org.contact_phone
  const email = ov.contact_email || org.contact_email
  const addrParts = [
    ov.address_street || org.address_street,
    [ov.address_city || org.address_city, ov.address_state || org.address_state].filter(Boolean).join(' - '),
    ov.address_zip || org.address_zip,
  ].filter(Boolean)

  const activeServices = Object.entries(proposal.services || {})
    .filter(([, v]: any) => v?.enabled)
  const methods: string[] = proposal.payment?.methods || []

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .proposal-paper { box-shadow: none !important; margin: 0 !important; max-width: none !important; border-radius: 0 !important; }
          .proposal-section { break-inside: avoid; }
          @page { margin: 14mm; }
        }
      `}</style>

      {/* Print bar */}
      <div className="no-print sticky top-0 z-10 bg-white/90 backdrop-blur border-b">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-600">Proposta de viagem</span>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-700"
          >
            <Printer className="w-4 h-4" /> Imprimir / Salvar PDF
          </button>
        </div>
      </div>

      <div className="proposal-paper max-w-3xl mx-auto my-6 bg-white shadow-sm rounded-xl overflow-hidden print:my-0">
        {/* Header */}
        <header className="px-8 py-6 border-b flex items-center gap-4">
          {logo && !imgErr['logo'] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={companyName} className="h-12 w-auto object-contain"
              onError={() => setImgErr(e => ({ ...e, logo: true }))} />
          ) : (
            <div className="h-12 w-12 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-lg">
              {companyName.charAt(0)}
            </div>
          )}
          <div>
            <p className="text-xl font-bold text-slate-900">{companyName}</p>
            <p className="text-sm text-slate-500">Proposta de viagem personalizada</p>
          </div>
        </header>

        <div className="px-8 py-6 space-y-8">
          {/* Title + period */}
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{proposal.title || 'Proposta de viagem'}</h1>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
              {proposal.client_name && <span><strong>Cliente:</strong> {proposal.client_name}</span>}
              <span><strong>Período:</strong> {fmtDate(proposal.start_date)} – {fmtDate(proposal.end_date)}</span>
              {proposal.travelers_note && <span><strong>Viajantes:</strong> {proposal.travelers_note}</span>}
            </div>
          </div>

          {/* Travelers */}
          {(proposal.travelers || []).length > 0 && (
            <Section title="Viajantes">
              <ul className="grid sm:grid-cols-2 gap-2">
                {proposal.travelers.map((t: any, i: number) => (
                  <li key={i} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <span className="text-slate-800">{t.name || 'Viajante'}</span>
                    {t.age && <span className="text-slate-500">{t.age} anos</span>}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Destinations */}
          {(proposal.destinations || []).length > 0 && (
            <Section title="Destinos">
              <div className="space-y-3">
                {proposal.destinations.map((d: any, i: number) => (
                  <div key={i} className="rounded-lg border border-slate-200 p-4">
                    <p className="font-semibold text-slate-800">{d.name || 'Destino'}</p>
                    {d.briefing && <p className="mt-1 text-sm text-slate-600 whitespace-pre-line">{d.briefing}</p>}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Flights */}
          {(proposal.flights || []).length > 0 && (
            <Section title="Voos">
              <div className="space-y-3">
                {proposal.flights.map((f: any, i: number) => (
                  <div key={i} className="rounded-lg border border-slate-200 p-4 text-sm">
                    <div className="flex items-center justify-between font-semibold text-slate-800">
                      <span>{[f.origin, f.destination].filter(Boolean).join(' → ') || 'Trecho'}</span>
                      <span className="text-slate-500 font-normal">{[f.airline, f.flight_number].filter(Boolean).join(' · ')}</span>
                    </div>
                    <div className="mt-2 grid sm:grid-cols-2 gap-x-6 gap-y-1 text-slate-600">
                      {f.departure_at && <span><strong>Embarque:</strong> {f.departure_at}</span>}
                      {f.arrival_at && <span><strong>Chegada:</strong> {f.arrival_at}</span>}
                      {f.connections && <span><strong>Conexões:</strong> {f.connections}</span>}
                      {f.baggage && <span><strong>Bagagem:</strong> {f.baggage}</span>}
                    </div>
                    {f.policies && <p className="mt-2 text-slate-500 whitespace-pre-line">{f.policies}</p>}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Hotels */}
          {(proposal.hotels || []).length > 0 && (
            <Section title="Hospedagem">
              <div className="space-y-4">
                {proposal.hotels.map((h: any, i: number) => {
                  const photos: string[] = Array.isArray(h.photos) ? h.photos : []
                  return (
                    <div key={i} className="rounded-lg border border-slate-200 p-4">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-slate-800">{h.name || 'Hospedagem'}</p>
                        {h.kind && <span className="text-xs text-slate-500">{h.kind}</span>}
                      </div>
                      <div className="mt-2 grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-slate-600">
                        {h.room_category && <span><strong>Quarto:</strong> {h.room_category}</span>}
                        {h.meal_plan && <span><strong>Regime:</strong> {h.meal_plan}</span>}
                      </div>
                      {h.briefing && <p className="mt-2 text-sm text-slate-600 whitespace-pre-line">{h.briefing}</p>}
                      {h.cancellation_policy && (
                        <p className="mt-2 text-xs text-slate-500"><strong>Cancelamento:</strong> {h.cancellation_policy}</p>
                      )}
                      {photos.length > 0 && (
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          {photos.map((src, j) => imgErr[`${i}-${j}`] ? null : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={j} src={src} alt="" className="h-24 w-full object-cover rounded-md border"
                              onError={() => setImgErr(e => ({ ...e, [`${i}-${j}`]: true }))} />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </Section>
          )}

          {/* Additional services */}
          {activeServices.length > 0 && (
            <Section title="Serviços adicionais">
              <ul className="space-y-2">
                {activeServices.map(([key, v]: any) => (
                  <li key={key} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <span className="font-medium text-slate-800">{SERVICE_LABELS[key] || key}</span>
                    {v.details && <span className="text-slate-600"> — {v.details}</span>}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Included / not included */}
          {((proposal.included || []).length > 0 || (proposal.not_included || []).length > 0) && (
            <Section title="Incluso e não incluso">
              <div className="grid sm:grid-cols-2 gap-6">
                {(proposal.included || []).length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-emerald-700 mb-2">Incluso</p>
                    <ul className="space-y-1 text-sm text-slate-700">
                      {proposal.included.map((it, i) => <li key={i} className="flex gap-2"><span className="text-emerald-600">✓</span>{it}</li>)}
                    </ul>
                  </div>
                )}
                {(proposal.not_included || []).length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-rose-700 mb-2">Não incluso</p>
                    <ul className="space-y-1 text-sm text-slate-700">
                      {proposal.not_included.map((it, i) => <li key={i} className="flex gap-2"><span className="text-rose-500">✕</span>{it}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Optionals */}
          {(proposal.order_bumps || []).length > 0 && (
            <Section title="Opcionais">
              <div className="space-y-2">
                {proposal.order_bumps.map((b: any, i: number) => (
                  <div key={i} className="flex items-start justify-between rounded-lg border border-slate-200 p-3">
                    <div>
                      <p className="font-medium text-slate-800 text-sm">{b.name || 'Opcional'}</p>
                      {b.description && <p className="text-xs text-slate-500">{b.description}</p>}
                    </div>
                    <span className="text-sm font-semibold text-slate-800 whitespace-nowrap">{brl(b.price_cents)}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Payment */}
          <Section title="Investimento">
            <div className="rounded-xl bg-slate-900 text-white p-5">
              <div className="flex items-end justify-between">
                <span className="text-sm text-slate-300">Valor total</span>
                <span className="text-3xl font-bold">{brl(proposal.total_cents)}</span>
              </div>
              {(proposal.pax_count || proposal.price_per_person_cents) && (
                <p className="mt-1 text-sm text-slate-300 text-right">
                  {proposal.price_per_person_cents ? `${brl(proposal.price_per_person_cents)} por pessoa` : ''}
                  {proposal.pax_count ? ` · ${proposal.pax_count} pax` : ''}
                </p>
              )}
            </div>
            {methods.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {methods.map(m => (
                  <span key={m} className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
                    {METHOD_LABELS[m] || m}
                  </span>
                ))}
              </div>
            )}
            {proposal.payment?.conditions && (
              <p className="mt-3 text-sm text-slate-600 whitespace-pre-line">{proposal.payment.conditions}</p>
            )}
          </Section>
        </div>

        {/* Footer */}
        <footer className="px-8 py-6 border-t bg-slate-50 text-xs text-slate-500 space-y-1">
          <p className="font-semibold text-slate-700">{companyName}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {cnpj && <span>CNPJ: {cnpj}</span>}
            {cadastur && <span>CADASTUR: {cadastur}</span>}
            {phone && <span>Tel: {phone}</span>}
            {email && <span>{email}</span>}
          </div>
          {addrParts.length > 0 && <p>{addrParts.join(', ')}</p>}
        </footer>
      </div>
    </div>
  )
}
