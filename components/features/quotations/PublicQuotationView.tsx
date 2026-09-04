'use client'

/**
 * Proposta pública de viagem — réplica do design handoff
 * `proposta-viagem-althos.html` (concierge editorial: Lora + Inter,
 * navy/gold/ivory, blocos retráteis, countdown, mapa Google Maps, modal do
 * hotel com dados cacheados do TripAdvisor).
 *
 * Também é usada como preview ao vivo dentro do editor (prop `preview`):
 * nesse modo não dispara eventos de tracking e campos vazios viram o
 * marcador [A CONFIRMAR].
 *
 * Split across four files (this one has the component itself):
 *   - PublicQuotationTypes.ts: the RPC contract types
 *   - PublicQuotationHelpers.tsx: formatters, inline icons, Rich/LazyImg/
 *     Lightbox/Block/useReveal
 *   - PublicQuotationStyles.ts: the CSS template string + urlHref/igHref
 */

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { importLibrary } from '@googlemaps/js-api-loader'
import {
  type QuotationOrg, type QuotationLodging, type QuotationFlight, type QuotationDay,
  type QuotationPin, type QuotationOtherProduct, type QuotationCruise, type PublicQuotation,
} from './PublicQuotationTypes'
import {
  ensureMapsOptions, pinIconUrl, d, fmtShort, fmtDayMonth, fmtBr, brl, nightsBetween,
  PIN_COLORS, LEG_LABELS, BAGGAGE_OPTIONS, CABIN_LABELS, hasHtml, Rich, ClampedDescription,
  IcPin, IcGlobe, IcCal, IcPlane, IcExt, IcWa, IcChat, IcIg, IcImg,
  IcShip, BAGGAGE_ICONS, LazyImg, Lightbox, Block, useReveal,
} from './PublicQuotationHelpers'
import { CSS, urlHref, igHref } from './PublicQuotationStyles'

export type {
  QuotationOrg, QuotationLodging, QuotationFlight, QuotationDay,
  QuotationPin, QuotationOtherProduct, QuotationCruise, PublicQuotation,
}
export { BAGGAGE_OPTIONS, CABIN_LABELS }

/* ═══════════════════════ componente principal ═══════════════════════ */
export default function PublicQuotationView({
  data, preview = false,
}: { data: PublicQuotation; preview?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const mapObj = useRef<any>(null)
  const miniMapRef = useRef<HTMLDivElement>(null)
  const [modalLodge, setModalLodge] = useState<QuotationLodging | null>(null)
  const [lightbox, setLightbox] = useState<{ photos: string[]; index: number } | null>(null)

  const org = data.org || {}
  const AC = '[A CONFIRMAR]'
  const t = (v?: string | null, fallback = '') => v || (preview ? AC : fallback)

  const lodgings = data.lodgings || []
  const altLodgings = lodgings.filter(l => l.is_alternative_option)
  const flights = data.flights || []
  const cruises = data.cruises || []
  const otherProducts = data.other_products || []
  const transfers = otherProducts.filter(p => p.product_type === 'transfer')
  const insurances = otherProducts.filter(p => p.product_type === 'seguro')
  const tours = otherProducts.filter(p => p.product_type === 'passeio')
  const rentals = otherProducts.filter(p => p.product_type === 'locacao')
  const days = data.itinerary_days || []
  const included = data.included || []
  const notIncluded = data.not_included || []
  const paymentConditions = (data.payment_conditions || []).filter(p => p?.label || p?.value)
  const destinations = Array.isArray(data.destinations) ? data.destinations.filter(x => x?.name) : []

  const paxTotal = (data.pax_adults || 0) + (data.pax_children || 0)
  const nights = nightsBetween(data.departure_date, data.return_date)
  const daysCount = nights != null ? nights + 1 : null

  // pins: exclusivamente o bloco "Mapa" (quotation_map_pins) — hospedagens
  // não entram mais automaticamente via TripAdvisor (localização às vezes
  // vinha errada); quem gerencia o mapa é o bloco dedicado no editor.
  const pins: QuotationPin[] = useMemo(() => {
    return (data.map_pins || []).filter(p => p && p.lat != null && p.lng != null)
  }, [data.map_pins])

  const pinTypes = Array.from(new Set(pins.map(p => p.type || 'attraction')))

  // countdown
  const [cd, setCd] = useState<string>('–')
  useEffect(() => {
    const dep = d(data.departure_date)
    if (!dep) { setCd(preview ? '–' : '✈'); return }
    const diff = Math.ceil((dep.getTime() - Date.now()) / 86400000)
    setCd(diff > 0 ? String(diff) : '✈')
  }, [data.departure_date, preview])

  useReveal(rootRef)

  /* tracking (só no link real) */
  useEffect(() => {
    if (preview) return
    const key = `alq_viewed_${data.id}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch { /* sessionStorage indisponível não impede o tracking */ }
    const token = window.location.pathname.split('/').pop()
    fetch('/api/track/proposal', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, type: 'viewed' }),
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const trackCta = useCallback((type: 'reservar' | 'duvidas') => {
    if (preview) return
    const token = window.location.pathname.split('/').pop()
    fetch('/api/track/proposal', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, type: 'cta_clicked', cta: type }),
    }).catch(() => {})
  }, [preview])

  /* mapa — inicializa só na primeira expansão */
  const initMap = useCallback(() => {
    if (mapObj.current || pins.length === 0) return
    setTimeout(async () => {
      if (mapObj.current || !mapRef.current) return
      ensureMapsOptions()
      const [{ Map, InfoWindow }, { Marker }, { LatLngBounds, Size, Point, event }] = await Promise.all([
        importLibrary('maps') as Promise<google.maps.MapsLibrary>,
        importLibrary('marker') as Promise<google.maps.MarkerLibrary>,
        importLibrary('core') as Promise<google.maps.CoreLibrary>,
      ])
      if (mapObj.current || !mapRef.current) return
      const map = new Map(mapRef.current, {
        scrollwheel: false, mapTypeControl: false, streetViewControl: false, fullscreenControl: false, clickableIcons: false,
      })
      mapObj.current = map
      const bounds = new LatLngBounds()
      pins.forEach(p => {
        const position = { lat: p.lat, lng: p.lng }
        const marker = new Marker({
          position, map,
          icon: {
            url: pinIconUrl(PIN_COLORS[p.type || 'attraction'] || '#0e5d63'),
            scaledSize: new Size(27, 36), anchor: new Point(13.5, 36),
          },
        })
        if (p.label) {
          const info = new InfoWindow({ content: `<b>${p.label.replace(/</g, '&lt;')}</b>` })
          marker.addListener('click', () => info.open({ map, anchor: marker }))
        }
        bounds.extend(position)
      })
      const recenter = () => {
        if (pins.length > 1) map.fitBounds(bounds, 40)
        else { map.setCenter(bounds.getCenter()); map.setZoom(12) }
      }
      recenter()
      // O bloco "Mapa da viagem" está dentro de um accordion retrátil — na
      // primeira expansão, o container ainda pode estar em transição de
      // altura quando o mapa é construído, fazendo o Google Maps calcular a
      // viewport errada e o marcador ficar deslocado do centro real.
      // Disparar 'resize' + recentralizar depois que a transição termina
      // corrige isso (equivalente ao invalidateSize() do Leaflet).
      setTimeout(() => { event.trigger(map, 'resize'); recenter() }, 300)
    }, 260)
  }, [pins])

  useEffect(() => () => { mapObj.current = null }, [])

  /* modal do hotel */
  const openHotel = useCallback((l: QuotationLodging) => {
    if (!l.tripadvisor_data) return
    setModalLodge(l)
    document.body.style.overflow = 'hidden'
  }, [])
  const closeHotel = useCallback(() => {
    setModalLodge(null)
    document.body.style.overflow = ''
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeHotel() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [closeHotel])
  useEffect(() => {
    if (!modalLodge || !miniMapRef.current) return
    const lat = modalLodge.tripadvisor_data?.lat ?? modalLodge.lat
    const lng = modalLodge.tripadvisor_data?.lng ?? modalLodge.lng
    if (lat == null || lng == null) return
    let cancelled = false
    const timer = setTimeout(async () => {
      ensureMapsOptions()
      const [{ Map }, { Marker }, { event }] = await Promise.all([
        importLibrary('maps') as Promise<google.maps.MapsLibrary>,
        importLibrary('marker') as Promise<google.maps.MarkerLibrary>,
        importLibrary('core') as Promise<google.maps.CoreLibrary>,
      ])
      if (cancelled || !miniMapRef.current || miniMapRef.current.dataset.ready) return
      miniMapRef.current.dataset.ready = '1'
      const map = new Map(miniMapRef.current, {
        center: { lat, lng }, zoom: 14, disableDefaultUI: true, gestureHandling: 'none', keyboardShortcuts: false, clickableIcons: false,
      })
      new Marker({ position: { lat, lng }, map })
      // O modal entra com transição de abertura — o mapa pode nascer com o
      // container ainda no tamanho errado, deslocando o marcador do centro
      // real. Redispara resize + recentraliza depois da transição terminar.
      setTimeout(() => { if (!cancelled) { event.trigger(map, 'resize'); map.setCenter({ lat, lng }) } }, 300)
    }, 200)
    return () => { cancelled = true; clearTimeout(timer); if (miniMapRef.current) delete miniMapRef.current.dataset.ready }
  }, [modalLodge])

  /* WhatsApp */
  const waDigits = (org.whatsapp_number || '').replace(/\D/g, '')
  const waNumber = waDigits ? (waDigits.length <= 11 ? `55${waDigits}` : waDigits) : ''
  const waHref = (msg: string) => `https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`

  /* accent white-label */
  const accentStyle = org.brand_accent
    ? ({ ['--gold' as any]: org.brand_accent, ['--gold-soft' as any]: org.brand_accent } as React.CSSProperties)
    : undefined

  /* numeração dinâmica dos blocos visíveis */
  let n = 0
  const num = () => String(++n).padStart(2, '0')

  return (
    <div className="alq" ref={rootRef} style={accentStyle}>
      <style>{CSS}</style>

      {/* ───── HERO ───── */}
      <header className="hero">
        <LazyImg src={data.cover_image_url} alt={data.title || 'Viagem'} />
        <div className="countdown">
          <div className="cd-num">{cd}</div>
          <div className="cd-lbl">dias para embarcar</div>
          <div className="cd-date">{fmtShort(data.departure_date) || (preview ? AC : '')}</div>
        </div>
        <div className="hero-inner">
          <div className="eyebrow">Proposta exclusiva{data.client_name ? ` · ${data.client_name}` : (preview ? ` · ${AC}` : '')}</div>
          <h1>{t(data.title, 'Proposta de viagem')}</h1>
          {(data.subtitle || preview) && <h2>{t(data.subtitle)}</h2>}
          {(paxTotal > 0 || data.occupancy_label) && (
            <div className="hero-meta">
              {paxTotal > 0 && <>{paxTotal} {paxTotal > 1 ? 'pessoas' : 'pessoa'}</>}
              {paxTotal > 0 && data.occupancy_label && ' · '}
              {data.occupancy_label}
            </div>
          )}
        </div>
      </header>

      <main className="wrap">
        {/* ───── 3 CARDS ───── */}
        <section className="facts reveal">
          <div className="fact">
            <IcPin />
            <div className="k">Saída</div>
            <div className="v">{t(data.origin_label)}{(data.origin_note || preview) && <small>{t(data.origin_note)}</small>}</div>
          </div>
          <div className="fact">
            <IcGlobe />
            <div className="k">Destino</div>
            <div className="v">
              {destinations[0]?.name || (preview ? AC : '—')}
              {(destinations[0]?.country || destinations.length > 1) && (
                <small>{[destinations[0]?.country, destinations.slice(1).map(x => x.name).join(' · ')].filter(Boolean).join(' · ')}</small>
              )}
            </div>
          </div>
          <div className="fact">
            <IcCal />
            <div className="k">Período</div>
            <div className="v">
              {data.departure_date || data.return_date
                ? <>de {fmtDayMonth(data.departure_date) || '—'} até {fmtDayMonth(data.return_date) || '—'}</>
                : (preview ? AC : '—')}
              {daysCount != null && <small>{daysCount} dias · {nights} noites</small>}
            </div>
          </div>
        </section>

        {/* ───── INTRO (só quando tem conteúdo real) ───── */}
        {hasHtml(data.intro_html) && (
          <section className="intro reveal">
            <Rich html={data.intro_html} />
            <div className="sig">
              <span>{org.legal_name || ''}</span>
            </div>
          </section>
        )}

        {/* ───── HOSPEDAGEM ───── */}
        {lodgings.length > 0 && (
          <Block num={num()} title="Hospedagem" defaultOpen
            sub={`${lodgings.length} ${lodgings.length > 1 ? 'opções' : lodgings[0].board ? `${lodgings[0].board.toLowerCase()}` : 'hospedagem'}${nights ? ` · ${nights} noites` : ''}`}>
            {lodgings.map((l, i) => {
              const ln = nightsBetween(l.check_in, l.check_out)
              const clickable = !!l.tripadvisor_data
              return (
                <div key={l.id || i} className="lodge">
                  {clickable ? (
                    <a className="name" role="button" tabIndex={0} onClick={() => openHotel(l)}
                      onKeyDown={e => { if (e.key === 'Enter') openHotel(l) }}>
                      {l.name || 'Hospedagem'} <IcExt />
                    </a>
                  ) : (
                    <span className="name static">{l.name || (preview ? AC : 'Hospedagem')}</span>
                  )}
                  <div className="meta">
                    {l.is_alternative_option && <span className="pill gold">Opção {altLodgings.indexOf(l) + 1}</span>}
                    {!!l.star_rating && (
                      <span className="pill stars-pill" title={`${l.star_rating} estrela${l.star_rating > 1 ? 's' : ''}`}>
                        {'★'.repeat(l.star_rating)}{'☆'.repeat(Math.max(0, 5 - l.star_rating))}
                      </span>
                    )}
                    {(l.check_in || l.check_out) && (
                      <span className="pill">{fmtDayMonth(l.check_in)} → {fmtDayMonth(l.check_out)}{ln ? ` · ${ln} noites` : ''}</span>
                    )}
                    {(l.check_in_time || l.check_out_time) && (
                      <span className="pill">
                        {l.check_in_time && `Check-in ${l.check_in_time}`}
                        {l.check_in_time && l.check_out_time && ' · '}
                        {l.check_out_time && `Check-out ${l.check_out_time}`}
                      </span>
                    )}
                    {l.room_category && <span className="pill gold">{l.room_category}</span>}
                    {l.board && <span className="pill">{l.board}</span>}
                  </div>
                  {/* Descrição só some do card quando há popup (clickable) pra vê-la lá —
                      sem TripAdvisor vinculado, não existe onde mais mostrá-la. */}
                  {!clickable && hasHtml(l.description_html) && <Rich html={l.description_html} />}
                  {(l.photos || []).length > 0 && (
                    <div className="gallery">
                      {(l.photos || []).slice(0, 5).map((src, k) => (
                        <button type="button" className="g" key={k} aria-label="Ampliar foto"
                          onClick={() => setLightbox({ photos: (l.photos || []), index: k })}>
                          {k === 0 && <span className="ph"><IcImg /></span>}
                          <LazyImg src={src} alt={l.name || ''} />
                          {k === 4 && (l.photos || []).length > 5 && (
                            <span className="g-more">+{(l.photos || []).length - 5}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </Block>
        )}

        {/* ───── AÉREO ───── */}
        {(flights.length > 0 || hasHtml(data.flights_html)) && (
          <Block num={num()} title="Aéreo"
            sub={flights.some(f => f.leg_type === 'inbound') ? 'Ida e volta' : 'Trechos da viagem'}>
            {hasHtml(data.flights_html) ? (
              <Rich html={data.flights_html} className="rich-body zoomable"
                onImageClick={src => setLightbox({ photos: [src], index: 0 })} />
            ) : flights.map((f, i) => {
              const bags = (f.baggage || []).filter(k => BAGGAGE_ICONS[k])
              return (
                <div className="flight-wrap" key={f.id || i}>
                  {/* Linha 1: tipo · data · duração · classe */}
                  <div className="fl-top">
                    <span className="fl-leg">{LEG_LABELS[f.leg_type || ''] || 'Trecho'}</span>
                    {fmtDayMonth(f.date) && <span className="fl-meta">{fmtDayMonth(f.date)}{f.departure_time ? ` ${f.departure_time}` : ''}</span>}
                    {(fmtDayMonth(f.arrival_date) || f.arrival_time) && (
                      <span className="fl-meta">→ {fmtDayMonth(f.arrival_date) || fmtDayMonth(f.date)}{f.arrival_time ? ` ${f.arrival_time}` : ''}</span>
                    )}
                    {f.duration_label && <span className="fl-meta">{f.duration_label}</span>}
                    {f.cabin_class && <span className="pill gold fl-cabin">{CABIN_LABELS[f.cabin_class] || f.cabin_class}</span>}
                  </div>
                  {/* Linha 2: origem → destino · cia · código */}
                  <div className="fl-mid">
                    <div className="route">
                      <div className="ap"><div className="code">{f.from_code || '—'}</div><div className="city">{f.from_city || ''}</div></div>
                      <div className="path"><IcPlane /></div>
                      <div className="ap"><div className="code">{f.to_code || '—'}</div><div className="city">{f.to_city || ''}</div></div>
                    </div>
                    {(f.airline || f.flight_number) && (
                      <span className="fl-airline">{[f.airline, f.flight_number].filter(Boolean).join(' · ')}</span>
                    )}
                  </div>
                  {(f.stopover_label || bags.length > 0) && (
                    <div className="fl-bags">
                      {f.stopover_label && <span className="fl-stop">{f.stopover_label}</span>}
                      {/* Linha 3: bagagem com ícone + texto reduzido */}
                      {bags.map(k => {
                        const Ic = BAGGAGE_ICONS[k]
                        const opt = BAGGAGE_OPTIONS.find(o => o.key === k)
                        return <span key={k} className="bag"><Ic />{opt?.short}</span>
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </Block>
        )}

        {/* ───── CRUZEIRO ───── */}
        {cruises.length > 0 && (
          <Block num={num()} title="Cruzeiro" sub={cruises.length > 1 ? `${cruises.length} cruzeiros` : undefined}>
            {cruises.map((c, i) => {
              const cd_ = c.data || {}
              const pkgs = [cd_.pkg_drinks, cd_.pkg_internet, cd_.pkg_restaurants].filter(Boolean)
              return (
                <div className="flight-wrap" key={c.id || i}>
                  <div className="fl-top">
                    <span className="fl-leg">{cd_.cruise_line || 'Cruzeiro'}</span>
                    {cd_.duration_nights && <span className="fl-meta">{cd_.duration_nights} noites</span>}
                    {cd_.itinerary_name && <span className="fl-meta">{cd_.itinerary_name}</span>}
                    {cd_.cabin_category && <span className="pill gold fl-cabin">{cd_.cabin_category}{cd_.cabin_type ? ` · ${cd_.cabin_type}` : ''}</span>}
                  </div>
                  <div className="fl-mid">
                    <div className="route">
                      <div className="ap"><div className="code">{cd_.embark_port || '—'}</div><div className="city">Embarque{fmtDayMonth(c.date_start) ? ` · ${fmtDayMonth(c.date_start)}` : ''}</div></div>
                      <div className="path"><IcShip /></div>
                      <div className="ap"><div className="code">{cd_.disembark_port || '—'}</div><div className="city">Desembarque{fmtDayMonth(c.date_end) ? ` · ${fmtDayMonth(c.date_end)}` : ''}</div></div>
                    </div>
                    {c.name && <span className="fl-airline">{c.name}</span>}
                  </div>
                  {pkgs.length > 0 && (
                    <div className="fl-bags">
                      {pkgs.map((p, j) => <span key={j} className="fl-stop">{p}</span>)}
                    </div>
                  )}
                  {(cd_.days?.length ?? 0) > 0 && (
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {cd_.days!.map((d, j) => (
                        <div key={j} style={{ display: 'flex', gap: 8, fontSize: 13 }}>
                          <span style={{ opacity: 0.6, minWidth: 16 }}>{d.day_number ?? j + 1}</span>
                          <span>
                            {d.port || 'Navegação'}
                            {d.date ? ` — ${fmtDayMonth(d.date)}` : ''}
                            {(d.arrival || d.departure) ? ` (${[d.arrival, d.departure].filter(Boolean).join(' / ')})` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </Block>
        )}

        {/* ───── TRANSFERS ───── */}
        {transfers.length > 0 && (
          <Block num={num()} title="Transfer" sub={transfers.length > 1 ? `${transfers.length} transfers` : undefined}>
            {transfers.map((t, i) => {
              const d_ = t.data || {}
              return (
                <div key={t.id || i} style={{ marginBottom: i < transfers.length - 1 ? 14 : 0, paddingBottom: i < transfers.length - 1 ? 14 : 0, borderBottom: i < transfers.length - 1 ? '1px solid var(--line)' : undefined }}>
                  {t.name && <p style={{ fontWeight: 600, marginBottom: 4 }}>{t.name}</p>}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, fontSize: 13 }}>
                    {d_.origin && <div><div style={{ opacity: 0.6, fontSize: 11 }}>ORIGEM</div>{d_.origin}</div>}
                    {d_.destination && <div><div style={{ opacity: 0.6, fontSize: 11 }}>DESTINO</div>{d_.destination}</div>}
                    {fmtDayMonth(t.date_start) && <div><div style={{ opacity: 0.6, fontSize: 11 }}>DATA</div>{fmtDayMonth(t.date_start)}{d_.time ? ` · ${d_.time}` : ''}</div>}
                    {d_.round_trip && fmtDayMonth(d_.return_date) && <div><div style={{ opacity: 0.6, fontSize: 11 }}>VOLTA</div>{fmtDayMonth(d_.return_date)}{d_.return_time ? ` · ${d_.return_time}` : ''}</div>}
                    {d_.vehicle && <div><div style={{ opacity: 0.6, fontSize: 11 }}>VEÍCULO</div>{d_.vehicle}</div>}
                    {d_.pax && <div><div style={{ opacity: 0.6, fontSize: 11 }}>PASSAGEIROS</div>{d_.pax}</div>}
                    {d_.transfer_type && <div><div style={{ opacity: 0.6, fontSize: 11 }}>TIPO</div>{d_.transfer_type}</div>}
                  </div>
                </div>
              )
            })}
          </Block>
        )}

        {/* ───── SEGURO VIAGEM ───── */}
        {insurances.length > 0 && (
          <Block num={num()} title="Seguro viagem" sub={insurances.length > 1 ? `${insurances.length} seguros` : undefined}>
            {insurances.map((s, i) => {
              const d_ = s.data || {}
              return (
                <div key={s.id || i} style={{ marginBottom: i < insurances.length - 1 ? 14 : 0, paddingBottom: i < insurances.length - 1 ? 14 : 0, borderBottom: i < insurances.length - 1 ? '1px solid var(--line)' : undefined }}>
                  {(d_.insurer || s.name) && <p style={{ fontWeight: 600, marginBottom: 4 }}>{d_.insurer || s.name}</p>}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, fontSize: 13 }}>
                    {d_.plan && <div><div style={{ opacity: 0.6, fontSize: 11 }}>PLANO</div>{d_.plan}</div>}
                    {d_.destination && <div><div style={{ opacity: 0.6, fontSize: 11 }}>DESTINO</div>{d_.destination}</div>}
                    {(fmtDayMonth(s.date_start) || fmtDayMonth(s.date_end)) && <div><div style={{ opacity: 0.6, fontSize: 11 }}>PERÍODO</div>{fmtDayMonth(s.date_start)} a {fmtDayMonth(s.date_end)}</div>}
                    {d_.travelers && <div><div style={{ opacity: 0.6, fontSize: 11 }}>VIAJANTES</div>{d_.travelers}</div>}
                  </div>
                  {d_.coverage && <p style={{ fontSize: 13, opacity: 0.8, marginTop: 8 }}>{d_.coverage}</p>}
                </div>
              )
            })}
          </Block>
        )}

        {/* ───── PASSEIOS/INGRESSOS ESTRUTURADOS ───── */}
        {tours.length > 0 && (
          <Block num={num()} title="Ingressos e passeios" sub={tours.length > 1 ? `${tours.length} passeios` : undefined}>
            {tours.map((t, i) => {
              const d_ = t.data || {}
              return (
                <div key={t.id || i} style={{ marginBottom: i < tours.length - 1 ? 14 : 0, paddingBottom: i < tours.length - 1 ? 14 : 0, borderBottom: i < tours.length - 1 ? '1px solid var(--line)' : undefined }}>
                  {t.name && <p style={{ fontWeight: 600, marginBottom: 4 }}>{t.name}</p>}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, fontSize: 13 }}>
                    {fmtDayMonth(t.date_start) && <div><div style={{ opacity: 0.6, fontSize: 11 }}>DATA</div>{fmtDayMonth(t.date_start)}</div>}
                    {d_.duration_label && <div><div style={{ opacity: 0.6, fontSize: 11 }}>DURAÇÃO</div>{d_.duration_label}</div>}
                    {d_.includes && <div><div style={{ opacity: 0.6, fontSize: 11 }}>INCLUI</div>{d_.includes}</div>}
                  </div>
                  {t.summary && <p style={{ fontSize: 13, opacity: 0.8, marginTop: 8 }}>{t.summary}</p>}
                </div>
              )
            })}
          </Block>
        )}

        {/* ───── LOCAÇÃO DE VEÍCULO ───── */}
        {rentals.length > 0 && (
          <Block num={num()} title="Locação de veículo" sub={rentals.length > 1 ? `${rentals.length} locações` : undefined}>
            {rentals.map((r, i) => {
              const d_ = r.data || {}
              return (
                <div key={r.id || i} style={{ marginBottom: i < rentals.length - 1 ? 14 : 0, paddingBottom: i < rentals.length - 1 ? 14 : 0, borderBottom: i < rentals.length - 1 ? '1px solid var(--line)' : undefined }}>
                  {(d_.company || r.name) && <p style={{ fontWeight: 600, marginBottom: 4 }}>{[d_.company, d_.vehicle_category].filter(Boolean).join(' — ') || r.name}</p>}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, fontSize: 13 }}>
                    {d_.pickup_location && <div><div style={{ opacity: 0.6, fontSize: 11 }}>RETIRADA</div>{d_.pickup_location}{fmtDayMonth(r.date_start) ? ` · ${fmtDayMonth(r.date_start)}` : ''}</div>}
                    {d_.dropoff_location && <div><div style={{ opacity: 0.6, fontSize: 11 }}>DEVOLUÇÃO</div>{d_.dropoff_location}{fmtDayMonth(r.date_end) ? ` · ${fmtDayMonth(r.date_end)}` : ''}</div>}
                  </div>
                  {d_.notes && <p style={{ fontSize: 12, opacity: 0.75, marginTop: 8, whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{d_.notes}</p>}
                </div>
              )
            })}
          </Block>
        )}

        {/* ───── MAPA ───── */}
        {pins.length > 0 && (
          <Block num={num()} title="Mapa da viagem" sub="Hospedagem e pontos marcados" onFirstOpen={initMap}>
            <div ref={mapRef} className="alq-map" />
            <div className="map-legend">
              {pinTypes.includes('lodging') && <span><i className="dot" style={{ background: PIN_COLORS.lodging }} /> Hospedagem</span>}
              {(pinTypes.includes('attraction') || pinTypes.includes('custom')) && <span><i className="dot" style={{ background: PIN_COLORS.attraction }} /> Atrações</span>}
              {pinTypes.includes('airport') && <span><i className="dot" style={{ background: PIN_COLORS.airport }} /> Aeroporto</span>}
            </div>
          </Block>
        )}

        {/* ───── ITINERÁRIO ───── */}
        {hasHtml(data.itinerary_html) ? (
          <Block num={num()} title="Itinerário" sub="Roteiro da viagem">
            <Rich html={data.itinerary_html} className="rich-body" />
          </Block>
        ) : days.length > 0 ? (
          <Block num={num()} title="Itinerário" sub="Dia a dia sugerido">
            <div className="timeline">
              {days.map((day, i) => (
                <div className="day" key={day.id || i}>
                  <div className="dh">
                    <span>{[day.day_label, fmtDayMonth(day.date)].filter(Boolean).join(' · ')}</span>
                    {day.title}
                  </div>
                  {(day.items || []).length > 0 && (
                    <ul>{(day.items || []).map((it, k) => <li key={k}>{it}</li>)}</ul>
                  )}
                </div>
              ))}
            </div>
          </Block>
        ) : null}

        {/* ───── PASSEIOS E INGRESSOS ───── */}
        {hasHtml(data.tours_html) && (
          <Block num={num()} title="Passeios e Ingressos" sub="Atrações e experiências da viagem">
            <Rich html={data.tours_html} className="rich-body" />
          </Block>
        )}

        {/* ───── IMPORTANTE ───── */}
        {hasHtml(data.important_html) && (
          <Block num={num()} title="Importante" sub="Antes de fechar, leia com atenção">
            <Rich html={data.important_html} className="important" />
          </Block>
        )}

        {/* ───── O QUE INCLUI ───── */}
        {(included.length > 0 || notIncluded.length > 0) && (
          <Block num={num()} title="O que inclui" sub="Tudo que está — e o que não está — no pacote">
            <div className="incl">
              {included.length > 0 && (
                <div className="col-ok">
                  <h4>Incluso</h4>
                  <ul className="yes">{included.map((it, i) => <li key={i}>{it}</li>)}</ul>
                </div>
              )}
              {notIncluded.length > 0 && (
                <div>
                  <h4 style={{ color: 'var(--no)' }}>Não incluso</h4>
                  <ul className="nope">{notIncluded.map((it, i) => <li key={i}>{it}</li>)}</ul>
                </div>
              )}
            </div>
          </Block>
        )}

        {/* ───── POLÍTICAS DE CANCELAMENTO ───── */}
        {hasHtml(data.cancellation_html) && (
          <Block num={num()} title="Políticas de cancelamento" sub="Condições de alteração, cancelamento e reembolso">
            <Rich html={data.cancellation_html} className="important" />
          </Block>
        )}

        {/* ───── INVESTIMENTO ───── */}
        <section className="invest reveal">
          <div className="eyebrow">Investimento</div>
          <h3>Valores do pacote</h3>
          {altLodgings.length > 1 ? (
            <>
              <p className="opt-note">Escolha uma das opções de hospedagem abaixo — o valor do pacote muda conforme a escolha.</p>
              <div className="opt-grid">
                {altLodgings.map((l, i) => (
                  <div className="opt-card" key={l.id || i}>
                    <span className="opt-badge">Opção {i + 1}</span>
                    <div className="opt-name">{l.name || `Hospedagem ${i + 1}`}</div>
                    {l.room_category && <div className="opt-room">{l.room_category}</div>}
                    <div className="opt-prices">
                      <div>
                        <div className="lbl">Por pessoa</div>
                        <div className="amt">{brl(l.option_price_per_person_cents) || (preview ? AC : '—')}</div>
                      </div>
                      <div>
                        <div className="lbl">Total</div>
                        <div className="amt">{brl(l.option_total_cents) || (preview ? AC : '—')}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="price-grid">
              <div className="price-card">
                <div className="lbl">Por pessoa</div>
                <div className="amt">{brl(data.price_per_person_cents) || (preview ? AC : '—')}</div>
                {data.occupancy_label && <div className="note">em {data.occupancy_label}</div>}
              </div>
              <div className="price-card total">
                <div className="lbl">Total{paxTotal > 0 ? ` · ${paxTotal} ${paxTotal > 1 ? 'pessoas' : 'pessoa'}` : ''}</div>
                <div className="amt">{brl(data.total_cents) || (preview ? AC : '—')}</div>
                <div className="note">pacote completo</div>
              </div>
            </div>
          )}
          {paymentConditions.length > 0 && (
            <div className="pay">
              {paymentConditions.map((p, i) => (
                <div className="row" key={i}><span>{p.label}:</span><b>{p.value}</b></div>
              ))}
            </div>
          )}
          <div className="disclaimer">
            {data.price_disclaimer || 'Preços sujeitos a alteração sem aviso prévio e à disponibilidade no momento da reserva.'}<br />
            {data.quoted_at && <>Cotação realizada em {fmtBr(data.quoted_at)} · câmbio e tarifas aéreas podem variar até a emissão.</>}
          </div>
        </section>

        {/* ───── FECHAMENTO + CTA ───── */}
        <section className="closing reveal">
          {hasHtml(data.closing_html)
            ? <Rich html={data.closing_html} className="closing-rich" />
            : <>
              <h3>Vamos garantir essa viagem?</h3>
              <p>É só dar o sinal verde que travamos a tarifa e reservamos tudo. Qualquer dúvida, chama no WhatsApp.</p>
            </>}
          {waNumber && (
            <div className="cta-row">
              <a className="btn btn-primary" target="_blank" rel="noopener noreferrer"
                onClick={() => trackCta('reservar')}
                href={waHref(`Oi! Quero reservar o pacote "${data.title || 'da proposta'}" ✈️`)}>
                <IcWa /> Reservar agora
              </a>
              <a className="btn btn-ghost" target="_blank" rel="noopener noreferrer"
                onClick={() => trackCta('duvidas')}
                href={waHref(`Oi! Tenho algumas dúvidas sobre a proposta "${data.title || 'de viagem'}"`)}>
                <IcChat /> Tirar dúvidas
              </a>
            </div>
          )}
        </section>

        {data.signature_enabled && (data.signature_name || data.signature_message || data.signature_photo_url) && (
          <section className="reveal">
            <div className="signature" style={{
              background: data.signature_bg_color || '#0f172a',
              color: data.signature_text_color || '#ffffff',
            }}>
              {data.signature_photo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.signature_photo_url} alt={data.signature_name || ''} className="signature-photo" />
              )}
              <div className="signature-text">
                {data.signature_name && <div className="signature-name">{data.signature_name}</div>}
                {data.signature_message && <div className="signature-message">{data.signature_message}</div>}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* ───── RODAPÉ ───── */}
      <footer>
        <div className="foot">
          {(org.instagram_url || org.site_url) && (
            <div className="social">
              {org.instagram_url && <>Confira também nosso Instagram
                <a href={igHref(org.instagram_url)} target="_blank" rel="noopener noreferrer" aria-label="Instagram"><IcIg /></a></>}
              {org.site_url && (
                <a href={urlHref(org.site_url)} target="_blank" rel="noopener noreferrer" aria-label="Site"><IcGlobe className="" /></a>
              )}
            </div>
          )}
          <div className="foot-sep" />
          {org.brand_logo_url
            ? <LazyImg src={org.brand_logo_url} alt={org.legal_name || ''} className="foot-logo-img" />
            : <div className="logo">{org.legal_name}</div>}
          <div className="legal">
            {(org.terms_url || org.privacy_url) && (
              <>
                {org.terms_url && <a href={org.terms_url} target="_blank" rel="noopener noreferrer">Termos de serviço</a>}
                {org.terms_url && org.privacy_url && ' · '}
                {org.privacy_url && <a href={org.privacy_url} target="_blank" rel="noopener noreferrer">Política de privacidade</a>}
                <br />
              </>
            )}
            {[
              org.city_state ? `Estamos em ${org.city_state}` : null,
              org.cnpj ? `CNPJ ${org.cnpj}` : null,
              org.cadastur ? `CADASTUR ${org.cadastur}` : null,
              org.phone || null,
              org.email || null,
            ].filter(Boolean).join(' · ')}
          </div>
          <div className="rights">© {new Date().getFullYear()} {org.legal_name} · Todos os direitos reservados.</div>
        </div>
      </footer>

      {/* ───── MODAL HOTEL ───── */}
      {modalLodge && (() => {
        const ta = modalLodge.tripadvisor_data!
        const rating = ta.rating || 0
        const filled = Math.round(rating)
        return (
          <div className="modal show" role="dialog" aria-modal="true">
            <div className="modal-bg" onClick={closeHotel} />
            <div className="modal-card">
              <div className="modal-hero">
                <button className="modal-close" onClick={closeHotel} aria-label="Fechar">×</button>
                <LazyImg src={ta.photos?.[0] || modalLodge.photos?.[0]} alt={modalLodge.name || ''} />
              </div>
              <div className="modal-in">
                <h3 style={{ fontSize: 24, color: 'var(--navy)' }}>{modalLodge.name}</h3>
                {ta.address && <div style={{ color: 'var(--muted)', fontSize: 13.5, margin: '4px 0 14px' }}>{ta.address}</div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {rating > 0 && <span className="rating">{rating.toFixed(1)} <span style={{ fontWeight: 400, fontSize: 12 }}>/5</span></span>}
                  {rating > 0 && <span className="stars">{'●'.repeat(filled)}{'○'.repeat(Math.max(0, 5 - filled))}</span>}
                  {ta.reviews_count ? <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{ta.reviews_count.toLocaleString('pt-BR')} avaliações</span> : null}
                </div>
                {(ta.photos || []).length > 1 && (
                  <div className="mini-gal">
                    {(ta.photos || []).slice(1, 5).map((src, i) => <div key={i}><LazyImg src={src} alt="" /></div>)}
                  </div>
                )}
                <ClampedDescription html={modalLodge.description_html} />
                <div ref={miniMapRef} className="mini-map" />
                <div className="ta-src">
                  Fotos, nota e informações extraídas do TripAdvisor
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ───── Lightbox das fotos ───── */}
      {lightbox && (
        <Lightbox photos={lightbox.photos} index={lightbox.index}
          onIndex={i => setLightbox(lb => lb && { ...lb, index: i })}
          onClose={() => setLightbox(null)} />
      )}
    </div>
  )
}

