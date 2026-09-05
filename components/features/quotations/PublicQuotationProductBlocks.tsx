'use client'

import {
  fmtDayMonth, nightsBetween, LEG_LABELS, CABIN_LABELS, BAGGAGE_OPTIONS, BAGGAGE_ICONS,
  PIN_COLORS, hasHtml, Rich, IcExt, IcImg, IcPlane, IcShip, LazyImg, Block,
} from './PublicQuotationHelpers'
import type { QuotationLodging, QuotationFlight, QuotationCruise, QuotationOtherProduct, QuotationPin } from './PublicQuotationTypes'

/**
 * Blocos de produtos da proposta pública (Hospedagem, Aéreo, Cruzeiro,
 * Transfer, Seguro, Passeios, Locação, Mapa) — puro código movido de
 * PublicQuotationView.tsx, sem mudança de comportamento. `num` já vem
 * calculado (numeração sequencial só dos blocos que de fato aparecem).
 */
export default function PublicQuotationProductBlocks({
  preview, nights,
  lodgings, altLodgings, openHotel, onZoomPhoto,
  flightsHtml, flights,
  cruises,
  transfers, insurances, tours, rentals,
  pins, pinTypes, mapRef, initMap,
  num,
}: {
  preview: boolean
  nights: number | null
  lodgings: QuotationLodging[]
  altLodgings: QuotationLodging[]
  openHotel: (l: QuotationLodging) => void
  onZoomPhoto: (photos: string[], index: number) => void
  flightsHtml?: string | null
  flights: QuotationFlight[]
  cruises: QuotationCruise[]
  transfers: QuotationOtherProduct[]
  insurances: QuotationOtherProduct[]
  tours: QuotationOtherProduct[]
  rentals: QuotationOtherProduct[]
  pins: QuotationPin[]
  pinTypes: string[]
  mapRef: React.RefObject<HTMLDivElement>
  initMap: () => void
  num: { lodging?: string; flights?: string; cruises?: string; transfers?: string; insurances?: string; tours?: string; rentals?: string; map?: string }
}) {
  return (
    <>
      {/* ───── HOSPEDAGEM ───── */}
      {lodgings.length > 0 && (
        <Block num={num.lodging!} title="Hospedagem" defaultOpen
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
                  <span className="name static">{l.name || (preview ? '[A CONFIRMAR]' : 'Hospedagem')}</span>
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
                        onClick={() => onZoomPhoto(l.photos || [], k)}>
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
      {(flights.length > 0 || hasHtml(flightsHtml)) && (
        <Block num={num.flights!} title="Aéreo"
          sub={flights.some(f => f.leg_type === 'inbound') ? 'Ida e volta' : 'Trechos da viagem'}>
          {hasHtml(flightsHtml) ? (
            <Rich html={flightsHtml} className="rich-body zoomable"
              onImageClick={src => onZoomPhoto([src], 0)} />
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
        <Block num={num.cruises!} title="Cruzeiro" sub={cruises.length > 1 ? `${cruises.length} cruzeiros` : undefined}>
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
        <Block num={num.transfers!} title="Transfer" sub={transfers.length > 1 ? `${transfers.length} transfers` : undefined}>
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
        <Block num={num.insurances!} title="Seguro viagem" sub={insurances.length > 1 ? `${insurances.length} seguros` : undefined}>
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
        <Block num={num.tours!} title="Ingressos e passeios" sub={tours.length > 1 ? `${tours.length} passeios` : undefined}>
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
        <Block num={num.rentals!} title="Locação de veículo" sub={rentals.length > 1 ? `${rentals.length} locações` : undefined}>
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
        <Block num={num.map!} title="Mapa da viagem" sub="Hospedagem e pontos marcados" onFirstOpen={initMap}>
          <div ref={mapRef} className="alq-map" />
          <div className="map-legend">
            {pinTypes.includes('lodging') && <span><i className="dot" style={{ background: PIN_COLORS.lodging }} /> Hospedagem</span>}
            {(pinTypes.includes('attraction') || pinTypes.includes('custom')) && <span><i className="dot" style={{ background: PIN_COLORS.attraction }} /> Atrações</span>}
            {pinTypes.includes('airport') && <span><i className="dot" style={{ background: PIN_COLORS.airport }} /> Aeroporto</span>}
          </div>
        </Block>
      )}
    </>
  )
}
