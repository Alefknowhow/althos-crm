'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { youtubeEmbedUrl, categoryLabel } from '@/lib/showcase'

type Org = {
  name: string | null
  logo_url: string | null
  cnpj: string | null
  cadastur: string | null
  contact_phone: string | null
  contact_email: string | null
  instagram: string | null
  website: string | null
  address_street: string | null
  address_city: string | null
  address_state: string | null
  address_zip: string | null
}

type Pkg = {
  title: string | null
  category: string | null
  youtube_url: string | null
  briefing: string | null
  cover_photos: string[]
  start_date: string | null
  end_date: string | null
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
    <section className="showcase-section">
      <h2 className="text-lg font-bold text-slate-800 border-b border-slate-200 pb-2 mb-4">{title}</h2>
      {children}
    </section>
  )
}

export default function PublicPackageView({
  pkg, org, backHref,
}: {
  pkg: Pkg
  org: Org
  backHref?: string
}) {
  const [imgErr, setImgErr] = useState<Record<string, boolean>>({})
  const companyName = org.name || 'Agência de Viagens'
  const logo = org.logo_url
  const embed = youtubeEmbedUrl(pkg.youtube_url)
  const cover = (pkg.cover_photos || []).filter(Boolean)
  const activeServices = Object.entries(pkg.services || {}).filter(([, v]: any) => v?.enabled)
  const methods: string[] = pkg.payment?.methods || []

  return (
    <div className="min-h-screen bg-slate-100">
      {/* top bar */}
      <div className="sticky top-0 z-10 bg-white/90   border-b">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          {backHref ? (
            <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900">
              <ArrowLeft className="w-4 h-4" /> Voltar à vitrine
            </Link>
          ) : <span className="text-sm font-medium text-slate-600">Pacote de viagem</span>}
          {logo && !imgErr['logo'] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={companyName} className="h-8 w-auto object-contain"
              onError={() => setImgErr(e => ({ ...e, logo: true }))} />
          ) : (
            <span className="text-sm font-semibold text-slate-700">{companyName}</span>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto my-6 bg-white   rounded-none overflow-hidden">
        <div className="px-6 sm:px-8 py-6 space-y-8">
          {/* 1) Título + datas no topo */}
          <div>
            {pkg.category && (
              <span className="inline-block mb-2 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                {categoryLabel(pkg.category)}
              </span>
            )}
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{pkg.title || 'Pacote de viagem'}</h1>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
              <span><strong>Período:</strong> {fmtDate(pkg.start_date)} – {fmtDate(pkg.end_date)}</span>
              {pkg.pax_count ? <span><strong>Pessoas:</strong> {pkg.pax_count}</span> : null}
            </div>
          </div>

          {/* 2) Imagens OU vídeo (no máximo ~1/3 da página) */}
          {(embed || cover.length > 0) && (
            <div className="flex flex-col items-center">
              <div className="w-full sm:w-2/3 md:w-1/2">
                {embed ? (
                  <div className="aspect-video w-full overflow-hidden rounded-lg border">
                    <iframe
                      src={embed}
                      title={pkg.title || 'Vídeo do pacote'}
                      className="h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={cover[0]} alt="" className="w-full aspect-video object-cover rounded-lg border"
                      onError={() => setImgErr(e => ({ ...e, cover0: true }))} />
                    {cover.length > 1 && (
                      <div className="mt-2 grid grid-cols-4 gap-2">
                        {cover.slice(1, 5).map((src, i) => imgErr[`c${i}`] ? null : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={i} src={src} alt="" className="aspect-square w-full object-cover rounded-md border"
                            onError={() => setImgErr(e => ({ ...e, [`c${i}`]: true }))} />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* 3) Briefing */}
          {pkg.briefing && (
            <p className="text-slate-700 whitespace-pre-line leading-relaxed">{pkg.briefing}</p>
          )}

          {/* Destinos */}
          {(pkg.destinations || []).length > 0 && (
            <Section title="Destinos">
              <div className="space-y-3">
                {pkg.destinations.map((d: any, i: number) => (
                  <div key={i} className="rounded-lg border border-slate-200 p-4">
                    <p className="font-semibold text-slate-800">{d.name || 'Destino'}</p>
                    {d.briefing && <p className="mt-1 text-sm text-slate-600 whitespace-pre-line">{d.briefing}</p>}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Voos */}
          {(pkg.flights || []).length > 0 && (
            <Section title="Voos">
              <div className="space-y-3">
                {pkg.flights.map((f: any, i: number) => (
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

          {/* Hospedagem */}
          {(pkg.hotels || []).length > 0 && (
            <Section title="Hospedagem">
              <div className="space-y-4">
                {pkg.hotels.map((h: any, i: number) => {
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

          {/* Serviços adicionais */}
          {activeServices.length > 0 && (
            <Section title="Serviços e translados">
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

          {/* Incluso / não incluso */}
          {((pkg.included || []).length > 0 || (pkg.not_included || []).length > 0) && (
            <Section title="Incluso e não incluso">
              <div className="grid sm:grid-cols-2 gap-6">
                {(pkg.included || []).length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-emerald-700 mb-2">Incluso</p>
                    <ul className="space-y-1 text-sm text-slate-700">
                      {pkg.included.map((it, i) => <li key={i} className="flex gap-2"><span className="text-emerald-600">✓</span>{it}</li>)}
                    </ul>
                  </div>
                )}
                {(pkg.not_included || []).length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-rose-700 mb-2">Não incluso</p>
                    <ul className="space-y-1 text-sm text-slate-700">
                      {pkg.not_included.map((it, i) => <li key={i} className="flex gap-2"><span className="text-rose-500">✕</span>{it}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Opcionais */}
          {(pkg.order_bumps || []).length > 0 && (
            <Section title="Opcionais">
              <div className="space-y-2">
                {pkg.order_bumps.map((b: any, i: number) => (
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

          {/* Pagamento */}
          <Section title="Plano de pagamento, condições e valores">
            <div className="rounded-none bg-slate-900 text-white p-5">
              <div className="flex items-end justify-between">
                <span className="text-sm text-slate-300">Valor total</span>
                <span className="text-3xl font-bold">{brl(pkg.total_cents)}</span>
              </div>
              {(pkg.pax_count || pkg.price_per_person_cents) && (
                <p className="mt-1 text-sm text-slate-300 text-right">
                  {pkg.price_per_person_cents ? `${brl(pkg.price_per_person_cents)} por pessoa` : ''}
                  {pkg.pax_count ? ` · ${pkg.pax_count} pax` : ''}
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
            {pkg.payment?.conditions && (
              <p className="mt-3 text-sm text-slate-600 whitespace-pre-line">{pkg.payment.conditions}</p>
            )}
            <p className="mt-4 text-xs text-slate-500 border-t border-slate-200 pt-3">
              Valores e tarifas estão sujeitos a alterações e disponibilidade. Consulte a agência para condições atualizadas.
            </p>
          </Section>
        </div>

        {/* Footer */}
        <footer className="px-6 sm:px-8 py-6 border-t bg-slate-50 text-xs text-slate-500 space-y-1">
          <p className="font-semibold text-slate-700">{companyName}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {org.cnpj && <span>CNPJ: {org.cnpj}</span>}
            {org.cadastur && <span>CADASTUR: {org.cadastur}</span>}
            {org.contact_phone && <span>Tel: {org.contact_phone}</span>}
            {org.contact_email && <span>{org.contact_email}</span>}
            {org.instagram && <span>Instagram: {org.instagram.startsWith('@') ? org.instagram : `@${org.instagram}`}</span>}
            {org.website && <span>{org.website.replace(/^https?:\/\//, '')}</span>}
          </div>
        </footer>
      </div>
    </div>
  )
}
