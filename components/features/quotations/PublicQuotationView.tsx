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
 * Split across several files (this one has the component itself):
 *   - PublicQuotationTypes.ts: the RPC contract types
 *   - PublicQuotationHelpers.tsx: formatters, inline icons, Rich/LazyImg/
 *     Lightbox/Block/useReveal
 *   - PublicQuotationStyles.ts: the CSS template string + urlHref/igHref
 *   - PublicQuotationProductBlocks.tsx: Hospedagem/Aéreo/Cruzeiro/Transfer/
 *     Seguro/Passeios/Locação/Mapa
 *   - PublicQuotationTravelInfo.tsx: Itinerário/Passeios(rich)/Importante/
 *     O que inclui/Políticas de cancelamento
 *   - PublicQuotationInvestment.tsx: Investimento/Fechamento+CTA/assinatura
 *   - PublicQuotationFooter.tsx: rodapé
 *   - PublicQuotationHotelModal.tsx: modal de detalhe do hotel
 */

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { importLibrary } from '@googlemaps/js-api-loader'
import {
  type QuotationOrg, type QuotationLodging, type QuotationFlight, type QuotationDay,
  type QuotationPin, type QuotationOtherProduct, type QuotationCruise, type PublicQuotation,
} from './PublicQuotationTypes'
import {
  ensureMapsOptions, pinIconUrl, d, fmtShort, fmtDayMonth, hasHtml, Rich, nightsBetween,
  IcPin, IcGlobe, IcCal,
  PIN_COLORS, BAGGAGE_OPTIONS, CABIN_LABELS, LazyImg, Lightbox, useReveal,
} from './PublicQuotationHelpers'
import { CSS } from './PublicQuotationStyles'
import PublicQuotationProductBlocks from './PublicQuotationProductBlocks'
import PublicQuotationTravelInfo from './PublicQuotationTravelInfo'
import PublicQuotationInvestment from './PublicQuotationInvestment'
import PublicQuotationFooter from './PublicQuotationFooter'
import PublicQuotationHotelModal from './PublicQuotationHotelModal'
import { computeQuotationBlockNumbers } from './computeQuotationBlockNumbers'

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

  /* numeração dinâmica dos blocos visíveis — calculada uma vez, na mesma
     ordem em que os blocos aparecem no JSX abaixo (idêntico ao contador
     `num()` incremental que existia antes da divisão em sub-componentes). */
  const num = useMemo(
    () => computeQuotationBlockNumbers(data, { lodgings, flights, cruises, transfers, insurances, tours, rentals, pins, days, included, notIncluded }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lodgings.length, flights.length, cruises.length, transfers.length, insurances.length, tours.length, rentals.length, pins.length, days.length, included.length, notIncluded.length, data.flights_html, data.itinerary_html, data.tours_html, data.important_html, data.cancellation_html],
  )

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

        <PublicQuotationProductBlocks
          preview={preview} nights={nights}
          lodgings={lodgings} altLodgings={altLodgings} openHotel={openHotel}
          onZoomPhoto={(photos, index) => setLightbox({ photos, index })}
          flightsHtml={data.flights_html} flights={flights}
          cruises={cruises}
          transfers={transfers} insurances={insurances} tours={tours} rentals={rentals}
          pins={pins} pinTypes={pinTypes} mapRef={mapRef} initMap={initMap}
          num={num}
        />

        <PublicQuotationTravelInfo
          itineraryHtml={data.itinerary_html} days={days}
          toursHtml={data.tours_html} importantHtml={data.important_html} cancellationHtml={data.cancellation_html}
          included={included} notIncluded={notIncluded}
          num={{ itinerary: num.itinerary, tours: num.toursHtml, important: num.important, includes: num.includes, cancellation: num.cancellation }}
        />

        <PublicQuotationInvestment
          data={data} preview={preview} altLodgings={altLodgings} paxTotal={paxTotal}
          paymentConditions={paymentConditions} waNumber={waNumber} waHref={waHref} trackCta={trackCta}
        />
      </main>

      <PublicQuotationFooter org={org} />

      {/* ───── MODAL HOTEL ───── */}
      {modalLodge && (
        <PublicQuotationHotelModal modalLodge={modalLodge} closeHotel={closeHotel} miniMapRef={miniMapRef} />
      )}

      {/* ───── Lightbox das fotos ───── */}
      {lightbox && (
        <Lightbox photos={lightbox.photos} index={lightbox.index}
          onIndex={i => setLightbox(lb => lb && { ...lb, index: i })}
          onClose={() => setLightbox(null)} />
      )}
    </div>
  )
}
