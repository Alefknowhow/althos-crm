'use client'

import { hasHtml, Rich, Block } from './PublicQuotationHelpers'
import { fmtDayMonth } from './PublicQuotationHelpers'
import type { QuotationDay } from './PublicQuotationTypes'

/**
 * Blocos de "informação da viagem" da proposta pública — Itinerário,
 * Passeios e Ingressos (rich text), Importante, O que inclui e Políticas de
 * cancelamento. Puro código movido de PublicQuotationView.tsx. `num` já vem
 * calculado (numeração sequencial só dos blocos que de fato aparecem).
 */
export default function PublicQuotationTravelInfo({
  itineraryHtml, days, toursHtml, importantHtml, cancellationHtml,
  included, notIncluded,
  num,
}: {
  itineraryHtml?: string | null
  days: QuotationDay[]
  toursHtml?: string | null
  importantHtml?: string | null
  cancellationHtml?: string | null
  included: string[]
  notIncluded: string[]
  num: { itinerary?: string; tours?: string; important?: string; includes?: string; cancellation?: string }
}) {
  return (
    <>
      {/* ───── ITINERÁRIO ───── */}
      {hasHtml(itineraryHtml) ? (
        <Block num={num.itinerary!} title="Itinerário" sub="Roteiro da viagem">
          <Rich html={itineraryHtml} className="rich-body" />
        </Block>
      ) : days.length > 0 ? (
        <Block num={num.itinerary!} title="Itinerário" sub="Dia a dia sugerido">
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
      {hasHtml(toursHtml) && (
        <Block num={num.tours!} title="Passeios e Ingressos" sub="Atrações e experiências da viagem">
          <Rich html={toursHtml} className="rich-body" />
        </Block>
      )}

      {/* ───── IMPORTANTE ───── */}
      {hasHtml(importantHtml) && (
        <Block num={num.important!} title="Importante" sub="Antes de fechar, leia com atenção">
          <Rich html={importantHtml} className="important" />
        </Block>
      )}

      {/* ───── O QUE INCLUI ───── */}
      {(included.length > 0 || notIncluded.length > 0) && (
        <Block num={num.includes!} title="O que inclui" sub="Tudo que está — e o que não está — no pacote">
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
      {hasHtml(cancellationHtml) && (
        <Block num={num.cancellation!} title="Políticas de cancelamento" sub="Condições de alteração, cancelamento e reembolso">
          <Rich html={cancellationHtml} className="important" />
        </Block>
      )}
    </>
  )
}
