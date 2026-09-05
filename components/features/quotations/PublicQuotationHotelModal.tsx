'use client'

import { LazyImg, ClampedDescription } from './PublicQuotationHelpers'
import type { QuotationLodging } from './PublicQuotationTypes'

/** Modal de detalhe do hotel (dados cacheados do TripAdvisor) — puro código
 *  movido de PublicQuotationView.tsx, sem mudança de comportamento. */
export default function PublicQuotationHotelModal({
  modalLodge, closeHotel, miniMapRef,
}: {
  modalLodge: QuotationLodging
  closeHotel: () => void
  miniMapRef: React.RefObject<HTMLDivElement>
}) {
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
}
