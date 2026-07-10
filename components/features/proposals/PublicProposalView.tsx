'use client'

import { useMemo, useState } from 'react'
import {
  Printer, MapPin, Plane, BedDouble, Sparkles, ListChecks,
  CheckCircle2, Wallet, CalendarDays, Users, Clock, ChevronLeft, ChevronRight,
  CloudSun, Thermometer, MessageCircle, Mail, Globe, Car, ShieldCheck, CreditCard, FileText,
} from 'lucide-react'

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
  checklist: string[]
  photos: string[]
  order_bumps: any[]
  total_cents: number
  pax_count: number | null
  price_per_person_cents: number | null
  payment: Record<string, any>
  weather: Record<string, any> | null
  company_override: Record<string, any> | null
  created_at: string | null
  updated_at: string | null
}

/* ───────────────────────── helpers ───────────────────────── */
function fmtTimestamp(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('pt-BR') : null
}
function brl(cents?: number | null) {
  return ((cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtDate(d?: string | null) {
  return d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—'
}
function flMins(min: number): string {
  if (!min || min <= 0) return ''
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h && m) return `${h}h ${m}min`
  if (h) return `${h}h`
  return `${m}min`
}
function flBetween(aIso?: string, bIso?: string): number {
  if (!aIso || !bIso) return 0
  const a = new Date(aIso).getTime()
  const b = new Date(bIso).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.round((b - a) / 60000)
}
function flNormalize(flights: any[]): any[] {
  return (Array.isArray(flights) ? flights : []).map((f, i) => {
    if (f && Array.isArray(f.legs)) {
      return { label: f.label || (i === 0 ? 'Voo de ida' : 'Voo de volta'), cabin_class: f.cabin_class || '', legs: f.legs, baggage: f.baggage || '', policies: f.policies || '' }
    }
    const hasData = f && (f.origin || f.destination || f.flight_number || f.airline)
    return {
      label: f?.label || (i === 0 ? 'Voo de ida' : 'Voo de volta'),
      cabin_class: f?.cabin_class || '',
      legs: hasData ? [f] : [],
      baggage: f?.baggage || '',
      policies: f?.policies || '',
    }
  })
}

const SERVICE_LABELS: Record<string, string> = {
  transfer: 'Traslado',
  insurance: 'Seguro viagem',
  car_rental: 'Locação de carro',
}
const METHOD_LABELS: Record<string, string> = {
  pix: 'Pix', boleto: 'Boleto', cartao: 'Cartão de crédito',
}

/* ───────────────────────── component ───────────────────────── */
export default function PublicProposalView({ proposal, org }: { proposal: Proposal; org: Org }) {
  const [imgErr, setImgErr] = useState<Record<string, boolean>>({})
  const [hotelImg, setHotelImg] = useState<Record<number, number>>({})
  const [checked, setChecked] = useState<Record<number, boolean>>({})

  const ov = proposal.company_override || {}
  const companyName = ov.name || org.name || 'Agência de Viagens'
  const logo = ov.logo_url || org.logo_url
  const cnpj = ov.cnpj || org.cnpj
  const cadastur = ov.cadastur || org.cadastur
  const phone = ov.contact_phone || org.contact_phone
  const email = ov.contact_email || org.contact_email
  const instagram = ov.instagram || org.instagram
  const website = ov.website || org.website
  const addrParts = [
    ov.address_street || org.address_street,
    [ov.address_city || org.address_city, ov.address_state || org.address_state].filter(Boolean).join(' - '),
    ov.address_zip || org.address_zip,
  ].filter(Boolean)

  const activeServices = Object.entries(proposal.services || {}).filter(([, v]: any) => v?.enabled)
  const orderBumps = Array.isArray(proposal.order_bumps) ? proposal.order_bumps : []
  const methods: string[] = proposal.payment?.methods || []
  const flights = useMemo(() => flNormalize(proposal.flights).filter(j => Array.isArray(j.legs) && j.legs.length > 0), [proposal.flights])
  const hotels = Array.isArray(proposal.hotels) ? proposal.hotels : []
  const destinations = Array.isArray(proposal.destinations) ? proposal.destinations : []
  const checklist = Array.isArray(proposal.checklist) ? proposal.checklist : []
  const cancellationPolicies = hotels
    .map((h: any, i: number) => ({ name: h.name || `Hospedagem ${i + 1}`, policy: (h.cancellation_policy || '').trim() }))
    .filter(h => h.policy)

  // Imagem da cotação (capa, fixa no topo). Usa as fotos da viagem; recai
  // sobre as fotos das hospedagens para propostas antigas.
  const rawHero: string[] = Array.isArray(proposal.photos) && proposal.photos.length > 0
    ? proposal.photos
    : hotels.flatMap((h: any) => (Array.isArray(h.photos) ? h.photos : []))
  const cover = rawHero.find((src: string) => src && !imgErr[`cover-${src}`]) || null

  // Duração + pessoas
  const nights = proposal.start_date && proposal.end_date
    ? Math.max(0, Math.round((new Date(proposal.end_date + 'T00:00:00').getTime() - new Date(proposal.start_date + 'T00:00:00').getTime()) / 86400000))
    : null
  const days = nights != null ? nights + 1 : null
  const paxCount = proposal.pax_count ?? (Array.isArray(proposal.travelers) && proposal.travelers.length > 0 ? proposal.travelers.length : null)

  // Clima: aba opcional sobre o tempo nas datas + sazonalidade do destino.
  const weather = proposal.weather || {}
  const weatherOn = !!weather.enabled && !!(
    weather.summary || weather.seasonality || weather.expect || weather.temp_min || weather.temp_max
  )

  return (
    <div className="pp-stage">
      <style>{CSS}</style>

      <button onClick={() => window.print()} className="pp-print no-print" aria-label="Imprimir ou salvar PDF">
        <Printer className="w-4 h-4" />
      </button>

      <div className="pp-phone">
        {/* Capa fixa */}
        <div className="pp-cover">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt={proposal.title || 'Viagem'} onError={() => setImgErr(e => ({ ...e, [`cover-${cover}`]: true }))} />
          ) : (
            <div className="pp-cover-fallback" />
          )}
          <div className="pp-cover-ov" />
          <div className="pp-cover-top">
            {logo && !imgErr['logo'] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt={companyName} className="pp-logo" onError={() => setImgErr(e => ({ ...e, logo: true }))} />
            ) : (
              <span className="pp-logo-fallback">{companyName.charAt(0)}</span>
            )}
            <span className="pp-company">{companyName}</span>
          </div>
          <div className="pp-cover-meta">
            <h1>{proposal.title || 'Proposta de viagem'}</h1>
            <p>
              {destinations.length > 0 && <span>{destinations.map((d: any) => d.name).filter(Boolean).join(' · ')}</span>}
              {destinations.length > 0 && (proposal.start_date || proposal.end_date) && <span className="dot">•</span>}
              {(proposal.start_date || proposal.end_date) && <span>{fmtDate(proposal.start_date)} – {fmtDate(proposal.end_date)}</span>}
            </p>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="pp-scroll">
          {/* ── Dados principais (sempre visível logo após a foto) ── */}
          <div className="pp-facts">
            {proposal.client_name && <Fact icon={Users} label="Cliente" value={proposal.client_name} />}
            {destinations.length > 0 && <Fact icon={MapPin} label="Destino" value={destinations.map((d: any) => d.name).filter(Boolean).join(' · ')} />}
            {(proposal.start_date || proposal.end_date) && <Fact icon={CalendarDays} label="Data" value={`${fmtDate(proposal.start_date)} – ${fmtDate(proposal.end_date)}`} />}
            {days != null && <Fact icon={Clock} label="Duração" value={`${days} ${days > 1 ? 'dias' : 'dia'} / ${nights} ${nights! > 1 ? 'noites' : 'noite'}`} />}
            {paxCount != null && <Fact icon={Users} label="Pessoas" value={`${paxCount} ${paxCount > 1 ? 'pessoas' : 'pessoa'}`} />}
          </div>

          {/* ── Briefing da viagem ── */}
          {proposal.travelers_note && (
            <section className="pp-section">
              <div className="pp-sec-head"><Sparkles className="w-4 h-4" /><h2 className="pp-sec-title">Briefing da viagem</h2></div>
              <p className="pp-card-text whitespace-pre-line">{proposal.travelers_note}</p>
            </section>
          )}

          {/* ── Dados da cotação ── */}
          <section className="pp-section">
            <div className="pp-sec-head"><FileText className="w-4 h-4" /><h2 className="pp-sec-title">Dados da cotação</h2></div>
            <div className="pp-stack">
              <div className="pp-card">
                <div className="pp-leg-grid">
                  {proposal.client_name && <span><b>Cliente:</b> {proposal.client_name}</span>}
                  {paxCount != null && <span><b>Viajantes:</b> {paxCount} {paxCount > 1 ? 'pessoas' : 'pessoa'}</span>}
                  {(proposal.start_date || proposal.end_date) && <span><b>Período:</b> {fmtDate(proposal.start_date)} – {fmtDate(proposal.end_date)}</span>}
                  {fmtTimestamp(proposal.updated_at || proposal.created_at) && <span><b>Cotação realizada em:</b> {fmtTimestamp(proposal.updated_at || proposal.created_at)}</span>}
                </div>
                <p className="pp-muted mt-2">Preços e tarifas estão sujeitos a alterações sem aviso prévio.</p>
              </div>
            </div>
          </section>

          {/* ── Destinos ── */}
          {destinations.length > 0 && (
            <section className="pp-section">
              <div className="pp-sec-head"><MapPin className="w-4 h-4" /><h2 className="pp-sec-title">Destinos</h2></div>
              <div className="pp-stack">
                {destinations.map((d: any, i: number) => (
                  <div key={i} className="pp-card">
                    <p className="pp-card-title"><MapPin className="w-4 h-4 text-slate-400" /> {d.name || 'Destino'}</p>
                    {d.briefing && <p className="pp-card-text">{d.briefing}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Clima ── */}
          {weatherOn && (
            <section className="pp-section">
              <div className="pp-sec-head"><CloudSun className="w-4 h-4" /><h2 className="pp-sec-title">Clima</h2></div>
              {(weather.temp_min || weather.temp_max) && (
                <div className="pp-weather-temp">
                  <Thermometer className="w-5 h-5" />
                  <span className="pp-weather-range">
                    {[weather.temp_min, weather.temp_max]
                      .filter(v => v != null && String(v).trim() !== '')
                      .map(v => {
                        const s = String(v).trim()
                        return /[°ºcCfF]/.test(s) ? s : `${s}°C`
                      })
                      .join(' — ')}
                  </span>
                  <span className="pp-weather-cap">Temperatura prevista nas datas da viagem</span>
                </div>
              )}
              {weather.summary && (
                <div className="pp-block">
                  <h3 className="pp-h3">Clima nas datas da viagem</h3>
                  <p className="pp-card-text whitespace-pre-line">{weather.summary}</p>
                </div>
              )}
              {weather.seasonality && (
                <div className="pp-block">
                  <h3 className="pp-h3">Sazonalidade do destino</h3>
                  <p className="pp-card-text whitespace-pre-line">{weather.seasonality}</p>
                </div>
              )}
              {weather.expect && (
                <div className="pp-block">
                  <h3 className="pp-h3">O que você vai encontrar</h3>
                  <p className="pp-card-text whitespace-pre-line">{weather.expect}</p>
                </div>
              )}
            </section>
          )}

          {/* ── Hospedagens ── */}
          {hotels.length > 0 && (
            <section className="pp-section">
              <div className="pp-sec-head"><BedDouble className="w-4 h-4" /><h2 className="pp-sec-title">Hospedagens</h2></div>
              <div className="pp-stack">
                {hotels.map((h: any, i: number) => {
                  const photos: string[] = (Array.isArray(h.photos) ? h.photos : []).filter((s: string) => s && !imgErr[`h${i}-${s}`])
                  const idx = Math.min(hotelImg[i] ?? 0, Math.max(0, photos.length - 1))
                  const fmtD = (d?: string) => {
                    if (!d) return ''
                    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d)
                    return m ? `${m[3]}/${m[2]}/${m[1]}` : d
                  }
                  return (
                    <div key={i} className="pp-hotel">
                      {photos.length > 0 && (
                        <div className="pp-hotel-photo">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={photos[idx]} alt={h.name || 'Hospedagem'} onError={() => setImgErr(e => ({ ...e, [`h${i}-${photos[idx]}`]: true }))} />
                          {photos.length > 1 && (
                            <>
                              <button className="pp-nav left" aria-label="Foto anterior"
                                onClick={() => setHotelImg(s => ({ ...s, [i]: (idx - 1 + photos.length) % photos.length }))}>
                                <ChevronLeft className="w-5 h-5" />
                              </button>
                              <button className="pp-nav right" aria-label="Próxima foto"
                                onClick={() => setHotelImg(s => ({ ...s, [i]: (idx + 1) % photos.length }))}>
                                <ChevronRight className="w-5 h-5" />
                              </button>
                              <div className="pp-dots">
                                {photos.map((_, k) => (
                                  <button key={k} aria-label={`Foto ${k + 1}`} className={k === idx ? 'on' : ''}
                                    onClick={() => setHotelImg(s => ({ ...s, [i]: k }))} />
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                      <div className="pp-hotel-body">
                        <div className="pp-hotel-head">
                          <p className="pp-card-title">{h.name || 'Hospedagem'}</p>
                          {h.kind && <span className="pp-muted">{h.kind}</span>}
                        </div>
                        <div className="pp-leg-grid">
                          {h.room_category && <span><b>Quarto:</b> {h.room_category}</span>}
                          {h.meal_plan && <span><b>Regime:</b> {h.meal_plan}</span>}
                          <span><b>Check-in:</b> {fmtD(h.checkin_date) ? `${fmtD(h.checkin_date)} · ` : ''}a partir das {h.checkin_time || '15:00'}</span>
                          <span><b>Check-out:</b> {fmtD(h.checkout_date) ? `${fmtD(h.checkout_date)} · ` : ''}até {h.checkout_time || '12:00'}</span>
                        </div>
                        {h.briefing && <p className="pp-card-text">{h.briefing}</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* ── Passeios (opcionais) ── */}
          {orderBumps.length > 0 && (
            <section className="pp-section">
              <div className="pp-sec-head"><Sparkles className="w-4 h-4" /><h2 className="pp-sec-title">Passeios</h2></div>
              <p className="pp-muted mb-2">Itens opcionais — não inclusos no valor do pacote.</p>
              <div className="pp-stack">
                {orderBumps.map((b: any, i: number) => (
                  <div key={i} className="pp-card pp-bump">
                    <div>
                      <p className="pp-card-title">{b.name || 'Passeio'}</p>
                      {b.description && <p className="pp-card-text">{b.description}</p>}
                    </div>
                    <span className="pp-bump-price">{brl(b.price_cents)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Transfer e serviços adicionais ── */}
          {activeServices.length > 0 && (
            <section className="pp-section">
              <div className="pp-sec-head"><Car className="w-4 h-4" /><h2 className="pp-sec-title">Transfer</h2></div>
              <div className="pp-stack">
                {activeServices.map(([key, v]: any) => (
                  <div key={key} className="pp-card">
                    <p className="pp-card-title">{SERVICE_LABELS[key] || key}</p>
                    {v.details && <p className="pp-card-text">{v.details}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Check-list ── */}
          {checklist.length > 0 && (
            <section className="pp-section">
              <div className="pp-sec-head"><ListChecks className="w-4 h-4" /><h2 className="pp-sec-title">Check-list</h2></div>
              <p className="pp-muted mb-3">Providencie estes itens antes da viagem. Toque para marcar.</p>
              <div className="pp-stack">
                {checklist.map((it, i) => (
                  <button key={i} className={`pp-check${checked[i] ? ' done' : ''}`}
                    onClick={() => setChecked(s => ({ ...s, [i]: !s[i] }))}>
                    <span className="pp-check-box">{checked[i] ? '✓' : ''}</span>
                    <span>{it}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* ── Voos ── */}
          {flights.length > 0 && (
            <section className="pp-section">
              <div className="pp-sec-head"><Plane className="w-4 h-4" /><h2 className="pp-sec-title">Voos</h2></div>
              <div className="pp-stack">
                {flights.map((j: any, i: number) => {
                  const legs: any[] = j.legs
                  const first = legs[0]
                  const last = legs[legs.length - 1]
                  const totalMin = flBetween(first.departure_utc, last.arrival_utc)
                  const stops = legs.length - 1
                  return (
                    <div key={i} className="pp-flight">
                      <div className="pp-flight-head">
                        <span className="pp-flight-title">✈ {j.label || 'Voo'}</span>
                        <span className="pp-flight-route">{first.origin} → {last.destination}</span>
                      </div>
                      <div className="pp-flight-tags">
                        {j.cabin_class && <span className="pp-pill">{j.cabin_class}</span>}
                        {totalMin > 0 && <span className="pp-muted">Duração {flMins(totalMin)}</span>}
                        <span className="pp-muted">{stops === 0 ? 'Direto' : `${stops} ${stops > 1 ? 'conexões' : 'conexão'}`}</span>
                      </div>
                      <div className="pp-legs">
                        {legs.map((l: any, k: number) => {
                          const layover = k > 0 ? flBetween(legs[k - 1].arrival_utc, l.departure_utc) : 0
                          const connAirport = k > 0 ? (legs[k - 1].destination || l.origin) : ''
                          return (
                            <div key={k}>
                              {k > 0 && (
                                <div className="pp-conn">↳ Conexão em {connAirport || '—'}{layover > 0 ? ` · ${flMins(layover)} de espera` : ''}</div>
                              )}
                              <div className="pp-leg">
                                <div className="pp-leg-top">
                                  <span>{[l.origin, l.destination].filter(Boolean).join(' → ') || 'Trecho'}</span>
                                  <span className="pp-muted">{[l.airline, l.flight_number].filter(Boolean).join(' · ')}</span>
                                </div>
                                {(l.origin_name || l.destination_name) && (
                                  <div className="pp-leg-sub">{[l.origin_name, l.destination_name].filter(Boolean).join(' → ')}</div>
                                )}
                                <div className="pp-leg-grid">
                                  {l.departure_at && <span><b>Embarque:</b> {l.departure_at}{l.origin_terminal ? ` · T${l.origin_terminal}` : ''}</span>}
                                  {l.arrival_at && <span><b>Chegada:</b> {l.arrival_at}{l.destination_terminal ? ` · T${l.destination_terminal}` : ''}</span>}
                                  {Number(l.duration_min) > 0 && <span><b>Duração:</b> {flMins(l.duration_min)}</span>}
                                  {l.aircraft && <span><b>Aeronave:</b> {l.aircraft}</span>}
                                  {l.connections && <span><b>Conexões:</b> {l.connections}</span>}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      {(j.baggage || j.policies) && (
                        <div className="pp-flight-foot">
                          {j.baggage && <p><b>Bagagem:</b> {j.baggage}</p>}
                          {j.policies && <p className="pp-muted whitespace-pre-line">{j.policies}</p>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* ── Política de cancelamento ── */}
          {cancellationPolicies.length > 0 && (
            <section className="pp-section">
              <div className="pp-sec-head"><ShieldCheck className="w-4 h-4" /><h2 className="pp-sec-title">Política de cancelamento</h2></div>
              <div className="pp-stack">
                {cancellationPolicies.map((h, i) => (
                  <div key={i} className="pp-card">
                    <p className="pp-card-title">{h.name}</p>
                    <p className="pp-card-text whitespace-pre-line">{h.policy}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Incluso ── */}
          {((proposal.included || []).length > 0 || (proposal.not_included || []).length > 0) && (
            <section className="pp-section">
              <div className="pp-sec-head"><CheckCircle2 className="w-4 h-4" /><h2 className="pp-sec-title">Incluso</h2></div>
              {(proposal.included || []).length > 0 && (
                <div className="pp-block">
                  <h3 className="pp-h3 text-emerald-700">Está incluso</h3>
                  <ul className="pp-list">
                    {proposal.included.map((it, i) => <li key={i}><span className="ok">✓</span>{it}</li>)}
                  </ul>
                </div>
              )}
              {(proposal.not_included || []).length > 0 && (
                <div className="pp-block">
                  <h3 className="pp-h3 text-rose-700">Não incluso</h3>
                  <ul className="pp-list">
                    {proposal.not_included.map((it, i) => <li key={i}><span className="no">✕</span>{it}</li>)}
                  </ul>
                </div>
              )}
            </section>
          )}

          {/* ── Investimento ── */}
          <section className="pp-section">
            <div className="pp-sec-head"><Wallet className="w-4 h-4" /><h2 className="pp-sec-title">Investimento</h2></div>
            <div className="pp-total">
              <span className="pp-total-label">Valor total</span>
              <span className="pp-total-val">{brl(proposal.total_cents)}</span>
              {(proposal.pax_count || proposal.price_per_person_cents) && (
                <span className="pp-total-sub">
                  {proposal.price_per_person_cents ? `${brl(proposal.price_per_person_cents)} por pessoa` : ''}
                  {proposal.pax_count ? ` · ${proposal.pax_count} pax` : ''}
                </span>
              )}
            </div>

            {/* CTA: abre o WhatsApp da agência com mensagem pré-definida */}
            {(() => {
              const digits = (phone || '').replace(/\D/g, '')
              const waNumber = digits ? (digits.length <= 11 ? `55${digits}` : digits) : ''
              const msg = `Quero reservar minha viagem para - ${proposal.title || 'a viagem'}`
              const href = waNumber
                ? `https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`
                : `https://wa.me/?text=${encodeURIComponent(msg)}`
              return (
                <a href={href} target="_blank" rel="noopener noreferrer" className="pp-reserve no-print">
                  <MessageCircle className="w-5 h-5" />
                  Quero reservar
                </a>
              )
            })()}
          </section>

          {/* ── Forma de pagamento ── */}
          {(methods.length > 0 || proposal.payment?.conditions) && (
            <section className="pp-section">
              <div className="pp-sec-head"><CreditCard className="w-4 h-4" /><h2 className="pp-sec-title">Forma de pagamento</h2></div>
              {methods.length > 0 && (
                <div className="pp-stack">
                  {methods.map(m => {
                    const cond = proposal.payment?.method_conditions?.[m]
                    return (
                      <div key={m} className="pp-pay">
                        <span className="pp-pill dark">{METHOD_LABELS[m] || m}</span>
                        {cond && <span className="pp-card-text">{cond}</span>}
                      </div>
                    )
                  })}
                </div>
              )}

              {proposal.payment?.conditions && (
                <p className="pp-card-text whitespace-pre-line mt-3">{proposal.payment.conditions}</p>
              )}
            </section>
          )}

          {(() => {
              // Telefone → WhatsApp
              const digits = (phone || '').replace(/\D/g, '')
              const waNumber = digits ? (digits.length <= 11 ? `55${digits}` : digits) : ''
              const waHref = waNumber ? `https://wa.me/${waNumber}` : ''
              // Site → garante protocolo
              const siteHref = website
                ? (/^https?:\/\//.test(website) ? website : `https://${website}`)
                : ''
              // Instagram → perfil
              const igHandle = instagram ? instagram.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '') : ''
              const igHref = igHandle ? `https://instagram.com/${igHandle}` : ''
              // Endereço → Google Maps
              const addrText = addrParts.join(', ')
              const mapHref = addrText ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${companyName} ${addrText}`)}` : ''

              return (
                <div className="pp-foot">
                  <p className="pp-foot-name">{companyName}</p>

                  {(cnpj || cadastur) && (
                    <div className="pp-foot-reg">
                      {cnpj && <span>CNPJ: {cnpj}</span>}
                      {cadastur && <span>CADASTUR: {cadastur}</span>}
                    </div>
                  )}

                  <div className="pp-foot-contacts">
                    {waHref && (
                      <a href={waHref} target="_blank" rel="noopener noreferrer" className="pp-foot-item">
                        <span className="pp-foot-ic" aria-hidden>
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                            <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.18 8.18 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.69 8.23-8.23 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.8-.23-.09-.39-.12-.56.12-.17.25-.64.8-.79.97-.14.17-.29.18-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43-.14-.01-.31-.01-.48-.01-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28Z" />
                          </svg>
                        </span>
                        <span>{phone}</span>
                      </a>
                    )}
                    {email && (
                      <a href={`mailto:${email}`} className="pp-foot-item">
                        <span className="pp-foot-ic" aria-hidden><Mail width={14} height={14} /></span>
                        <span>{email}</span>
                      </a>
                    )}
                    {siteHref && (
                      <a href={siteHref} target="_blank" rel="noopener noreferrer" className="pp-foot-item">
                        <span className="pp-foot-ic" aria-hidden><Globe width={14} height={14} /></span>
                        <span>{website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
                      </a>
                    )}
                    {igHref && (
                      <a href={igHref} target="_blank" rel="noopener noreferrer" className="pp-foot-item">
                        <span className="pp-foot-ic" aria-hidden>
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37Z" />
                            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                          </svg>
                        </span>
                        <span>@{igHandle}</span>
                      </a>
                    )}
                    {addrText && (
                      <a href={mapHref} target="_blank" rel="noopener noreferrer" className="pp-foot-item">
                        <span className="pp-foot-ic" aria-hidden><MapPin width={14} height={14} /></span>
                        <span>{addrText}</span>
                      </a>
                    )}
                  </div>
                </div>
              )
            })()}
        </div>
      </div>
    </div>
  )
}

function Fact({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="pp-fact">
      <Icon className="w-4 h-4 text-slate-400" />
      <span className="pp-fact-label">{label}</span>
      <span className="pp-fact-value">{value}</span>
    </div>
  )
}

const CSS = `
.pp-stage { min-height: 100vh; min-height: 100dvh; background: #e6e8ee; display: flex; align-items: center; justify-content: center; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
@media (min-width: 640px) { .pp-stage { padding: 24px; } }

.pp-print { position: fixed; top: 14px; right: 14px; z-index: 50; display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 999px; background: #0f172a; color: #fff; box-shadow: 0 8px 24px -8px rgba(15,23,42,0.5); }
.pp-print:hover { background: #1e293b; }

.pp-phone { position: relative; width: 100vw; height: 100vh; height: 100dvh; background: #fff; display: flex; flex-direction: column; overflow: hidden; }
@media (min-width: 640px) {
  .pp-phone { width: auto; height: min(900px, 94vh); aspect-ratio: 9 / 16; border-radius: 30px; border: 1px solid rgba(15,23,42,0.08); box-shadow: 0 40px 90px -25px rgba(15,23,42,0.45); }
}

/* Capa */
.pp-cover { position: relative; flex: 0 0 38%; min-height: 190px; background: #0f172a; overflow: hidden; }
.pp-cover > img { width: 100%; height: 100%; object-fit: cover; }
.pp-cover-fallback { position: absolute; inset: 0; background: radial-gradient(120% 100% at 30% 0%, #334155, #0f172a 70%); }
.pp-cover-ov { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(15,23,42,0.45) 0%, rgba(15,23,42,0) 30%, rgba(15,23,42,0) 45%, rgba(15,23,42,0.82) 100%); }
.pp-cover-top { position: absolute; top: 0; left: 0; right: 0; display: flex; align-items: center; gap: 8px; padding: 14px 16px; }
.pp-logo { height: 30px; width: auto; max-width: 120px; object-fit: contain; filter: drop-shadow(0 1px 4px rgba(0,0,0,0.4)); }
.pp-logo-fallback { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 8px; background: rgba(255,255,255,0.18); color: #fff; font-weight: 700; backdrop-filter: blur(4px); }
.pp-company { font-size: 13px; font-weight: 600; color: #fff; text-shadow: 0 1px 6px rgba(0,0,0,0.5); }
.pp-cover-meta { position: absolute; left: 0; right: 0; bottom: 0; padding: 16px; color: #fff; }
.pp-cover-meta h1 { font-size: 22px; line-height: 1.15; font-weight: 800; letter-spacing: -0.02em; text-shadow: 0 2px 12px rgba(0,0,0,0.4); }
.pp-cover-meta p { margin-top: 6px; font-size: 12.5px; font-weight: 500; color: rgba(255,255,255,0.92); display: flex; flex-wrap: wrap; align-items: center; gap: 6px; text-shadow: 0 1px 6px rgba(0,0,0,0.5); }
.pp-cover-meta .dot { opacity: 0.6; }

/* Conteúdo */
.pp-scroll { flex: 1 1 auto; overflow-y: auto; -webkit-overflow-scrolling: touch; background: #f8fafc; padding: 16px; }
.pp-section { padding-top: 22px; margin-top: 22px; border-top: 1px solid #eef0f4; }
.pp-section:first-of-type { padding-top: 0; margin-top: 22px; }
.pp-sec-head { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; color: #0f172a; }
.pp-sec-title { font-size: 15px; font-weight: 800; letter-spacing: -0.01em; color: #0f172a; }
.pp-block { margin-top: 18px; }
.pp-block:first-child { margin-top: 0; }
.pp-h3 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #475569; margin-bottom: 10px; }
.pp-stack { display: flex; flex-direction: column; gap: 10px; }
.pp-card { background: #fff; border: 1px solid #e9edf3; border-radius: 14px; padding: 14px; box-shadow: 0 1px 2px rgba(15,23,42,0.04); }
.pp-card-title { display: flex; align-items: center; gap: 6px; font-size: 14.5px; font-weight: 700; color: #1e293b; }
.pp-card-text { margin-top: 6px; font-size: 13.5px; line-height: 1.55; color: #475569; }
.pp-muted { font-size: 12px; color: #94a3b8; }

/* Resumo: fatos */
.pp-facts { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.pp-fact { background: #fff; border: 1px solid #e9edf3; border-radius: 14px; padding: 12px; display: flex; flex-direction: column; gap: 2px; box-shadow: 0 1px 2px rgba(15,23,42,0.04); }
.pp-fact-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: #94a3b8; margin-top: 4px; }
.pp-fact-value { font-size: 14px; font-weight: 700; color: #1e293b; }

/* Voos */
.pp-flight { background: #fff; border: 1px solid #e9edf3; border-radius: 14px; overflow: hidden; box-shadow: 0 1px 2px rgba(15,23,42,0.04); }
.pp-flight-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px; padding: 11px 14px 4px; }
.pp-flight-title { font-size: 14.5px; font-weight: 700; color: #1e293b; }
.pp-flight-route { font-size: 13px; color: #64748b; }
.pp-flight-tags { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; padding: 0 14px 11px; border-bottom: 1px solid #f1f5f9; }
.pp-pill { font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 999px; background: #f1f5f9; color: #334155; }
.pp-pill.dark { background: #0f172a; color: #fff; }
.pp-legs { display: flex; flex-direction: column; }
.pp-leg { padding: 11px 14px; border-top: 1px solid #f1f5f9; }
.pp-leg:first-child { border-top: 0; }
.pp-leg-top { display: flex; justify-content: space-between; gap: 8px; font-size: 13.5px; font-weight: 700; color: #1e293b; }
.pp-leg-sub { margin-top: 2px; font-size: 11.5px; color: #94a3b8; }
.pp-leg-grid { margin-top: 8px; display: grid; gap: 3px 14px; font-size: 12.5px; color: #475569; }
.pp-leg-grid b { font-weight: 600; color: #334155; }
.pp-conn { background: #fffbeb; color: #b45309; font-size: 11.5px; padding: 6px 14px; }
.pp-flight-foot { background: #f8fafc; border-top: 1px solid #f1f5f9; padding: 10px 14px; font-size: 12px; color: #475569; display: flex; flex-direction: column; gap: 3px; }
.pp-flight-foot b { color: #334155; }

/* Hospedagem */
.pp-hotel { background: #fff; border: 1px solid #e9edf3; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 2px rgba(15,23,42,0.04); }
.pp-hotel-photo { position: relative; aspect-ratio: 16 / 10; background: #eef2f7; }
.pp-hotel-photo img { width: 100%; height: 100%; object-fit: cover; }
.pp-nav { position: absolute; top: 50%; transform: translateY(-50%); display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 999px; background: rgba(15,23,42,0.55); color: #fff; backdrop-filter: blur(2px); }
.pp-nav.left { left: 8px; }
.pp-nav.right { right: 8px; }
.pp-nav:hover { background: rgba(15,23,42,0.78); }
.pp-dots { position: absolute; left: 0; right: 0; bottom: 8px; display: flex; justify-content: center; gap: 5px; }
.pp-dots button { width: 6px; height: 6px; border-radius: 999px; background: rgba(255,255,255,0.55); }
.pp-dots button.on { background: #fff; width: 16px; }
.pp-hotel-body { padding: 14px; }
.pp-hotel-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }

/* Serviços / opcionais */
.pp-bump { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.pp-bump-price { font-size: 14px; font-weight: 700; color: #1e293b; white-space: nowrap; }

/* Checklist */
.pp-check { display: flex; align-items: flex-start; gap: 10px; text-align: left; width: 100%; background: #fff; border: 1px solid #e9edf3; border-radius: 12px; padding: 12px 14px; font-size: 13.5px; color: #334155; transition: background .15s, border-color .15s; }
.pp-check:hover { border-color: #cbd5e1; }
.pp-check.done { background: #f0fdf4; border-color: #bbf7d0; color: #166534; text-decoration: line-through; text-decoration-color: rgba(22,101,52,0.4); }
.pp-check-box { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 6px; border: 1.5px solid #cbd5e1; color: #16a34a; font-size: 13px; font-weight: 700; }
.pp-check.done .pp-check-box { background: #16a34a; border-color: #16a34a; color: #fff; }

/* Clima */
.pp-weather-temp { display: flex; flex-direction: column; align-items: center; gap: 2px; background: linear-gradient(160deg, #0ea5e9, #0f172a); color: #fff; border-radius: 18px; padding: 20px; text-align: center; }
.pp-weather-temp > svg { opacity: 0.85; }
.pp-weather-range { font-size: 28px; font-weight: 800; letter-spacing: -0.02em; margin-top: 4px; }
.pp-weather-cap { font-size: 12px; color: rgba(255,255,255,0.82); }

/* Incluso */
.pp-list { display: flex; flex-direction: column; gap: 7px; }
.pp-list li { display: flex; gap: 8px; font-size: 13.5px; line-height: 1.45; color: #334155; }
.pp-list .ok { color: #16a34a; font-weight: 700; }
.pp-list .no { color: #e11d48; font-weight: 700; }

/* Investimento */
.pp-total { background: #0f172a; color: #fff; border-radius: 18px; padding: 20px; display: flex; flex-direction: column; }
.pp-total-label { font-size: 12.5px; color: #94a3b8; }
.pp-total-val { font-size: 32px; font-weight: 800; letter-spacing: -0.02em; margin-top: 2px; }
.pp-total-sub { font-size: 12.5px; color: #cbd5e1; margin-top: 4px; }
.pp-reserve { margin-top: 14px; display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; background: #16a34a; color: #fff; font-size: 15px; font-weight: 700; padding: 14px; border-radius: 14px; box-shadow: 0 10px 24px -10px rgba(22,163,74,0.65); transition: background .2s, transform .1s; }
.pp-reserve:hover { background: #15803d; }
.pp-reserve:active { transform: translateY(1px); }
.pp-pay { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; }
.pp-fineprint { margin-top: 16px; padding-top: 12px; border-top: 1px solid #e9edf3; font-size: 11.5px; color: #94a3b8; line-height: 1.5; }
.pp-foot { margin-top: 16px; padding: 18px 16px; background: #fff; border: 1px solid #e9edf3; border-radius: 14px; font-size: 12px; color: #64748b; text-align: center; }
.pp-foot-name { font-weight: 700; color: #1e293b; font-size: 15px; text-align: center; letter-spacing: -0.01em; }
.pp-foot-reg { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 14px; margin: 8px 0 12px; font-size: 11px; color: #94a3b8; }
.pp-foot-contacts { display: flex; flex-direction: column; align-items: center; gap: 8px; padding-top: 12px; border-top: 1px solid #f1f5f9; }
.pp-foot-item { display: inline-flex; align-items: center; gap: 8px; color: #475569; text-decoration: none; font-size: 12.5px; line-height: 1.3; transition: color .15s; max-width: 100%; }
.pp-foot-item:hover { color: #4f46e5; }
.pp-foot-item > span:last-child { word-break: break-word; }
.pp-foot-ic { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; flex-shrink: 0; border-radius: 8px; background: #f1f5f9; color: #4f46e5; }
.pp-foot-item:hover .pp-foot-ic { background: #e0e7ff; }

/* Print: empilha tudo, sem moldura */
@media print {
  .no-print { display: none !important; }
  .pp-stage { display: block; background: #fff; padding: 0; }
  .pp-phone { width: auto !important; height: auto !important; aspect-ratio: auto !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; display: block; overflow: visible; }
  .pp-cover { flex: none; height: 280px; }
  .pp-scroll { overflow: visible; height: auto; background: #fff; padding: 18px 24px; }
  .pp-section { break-inside: avoid; }
  .pp-card, .pp-flight, .pp-hotel, .pp-fact, .pp-check { break-inside: avoid; }
  .pp-stage, .pp-stage * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
}
`
