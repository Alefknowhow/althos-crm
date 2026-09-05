'use client'

import { brl, fmtBr, hasHtml, Rich, IcWa, IcChat } from './PublicQuotationHelpers'
import type { QuotationLodging, PublicQuotation } from './PublicQuotationTypes'

/**
 * Seção "Investimento" + "Fechamento/CTA" + assinatura da proposta pública
 * — puro código movido de PublicQuotationView.tsx, sem mudança de
 * comportamento.
 */
export default function PublicQuotationInvestment({
  data, preview, altLodgings, paxTotal, paymentConditions, waNumber, waHref, trackCta,
}: {
  data: PublicQuotation
  preview: boolean
  altLodgings: QuotationLodging[]
  paxTotal: number
  paymentConditions: { label?: string; value?: string }[]
  waNumber: string
  waHref: (msg: string) => string
  trackCta: (type: 'reservar' | 'duvidas') => void
}) {
  const AC = '[A CONFIRMAR]'
  return (
    <>
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
    </>
  )
}
