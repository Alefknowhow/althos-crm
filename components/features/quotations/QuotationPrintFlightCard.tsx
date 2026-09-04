'use client'

/**
 * Flight card (all legs — ida/volta/conexão — render as one indivisible
 * card) for QuotationPrintView's document. Split out of
 * QuotationPrintCards.tsx.
 */

import { Clock, Plane } from 'lucide-react'
import { BAGGAGE_OPTIONS, CABIN_LABELS } from './PublicQuotationView'
import { fmtDate, CardHeader, CardShell } from './QuotationPrintCards'

const FARE_CONDITION_LABELS: Record<string, string> = {
  nao_reembolsavel: 'Não reembolsável',
  alteracao_com_custo: 'Permite alteração com custo',
  nao_permite_alteracao: 'Não permite alteração',
}

type FlightLeg = Record<string, any>

export function FlightCard({ legs, fareConditions }: { legs: FlightLeg[]; fareConditions: string[] }) {
  const idas = legs.filter(f => f.leg_type === 'outbound')
  const voltas = legs.filter(f => f.leg_type === 'inbound')
  const conexoes = legs.filter(f => f.leg_type === 'connection')
  const groups = [
    { label: 'Ida', legs: idas }, { label: 'Volta', legs: voltas }, { label: 'Conexão', legs: conexoes },
  ].filter(g => g.legs.length > 0)

  const route = [legs[0]?.from_city || legs[0]?.from_code, legs[legs.length - 1]?.to_city || legs[legs.length - 1]?.to_code]
    .filter(Boolean).join(' — ')

  const allBaggage = Array.from(new Set(legs.flatMap(f => (f.baggage || []) as string[])))

  return (
    <CardShell>
      <CardHeader icon={Plane} title="Aéreo" right={fareConditions.length > 0 && (
        <span className="flex flex-wrap justify-end gap-[1mm]">
          {fareConditions.map(fc => (
            <span key={fc} className="text-[6.5pt] text-[#555] border-[0.6pt] border-[#D0D0D0] rounded-full px-[2mm] py-[0.5mm] whitespace-nowrap">{FARE_CONDITION_LABELS[fc] || fc}</span>
          ))}
        </span>
      )} />
      {route && <p className="text-[11pt] font-bold text-[#111] mb-[2.5mm]">{route}</p>}

      {groups.map(group => (
        <div key={group.label} className="mb-[3mm] last:mb-0">
          {group.legs.map((f, i) => {
            const bag = BAGGAGE_OPTIONS.filter(b => (f.baggage || []).includes(b.key)).map(b => b.short).join(' · ')
            const cabin = f.cabin_class ? CABIN_LABELS[f.cabin_class] || f.cabin_class : ''
            return (
              <div key={i} className="mb-[2mm] last:mb-0">
                <p className="text-[8pt] font-semibold text-[#555] mb-[1mm]">
                  {group.label} {[f.from_city || f.from_code, f.to_city || f.to_code].filter(Boolean).join(' — ')}
                </p>
                <div className="flex items-center gap-[2mm]">
                  <div className="flex-1 min-w-0">
                    {(f.date || f.departure_time) && (
                      <p className="text-[11pt] font-bold text-[#111]">
                        {f.departure_time || ''} {f.from_code || ''}
                        {fmtDate(f.date) && <span className="text-[7pt] font-normal text-[#777]"> · {fmtDate(f.date)}</span>}
                      </p>
                    )}
                    <p className="text-[7pt] text-[#777]">{f.from_city || ''}</p>
                  </div>
                  <div className="flex flex-col items-center px-[2mm] shrink-0">
                    {f.duration_label && <p className="text-[7pt] text-[#555]">{f.duration_label}</p>}
                    <div className="w-[16mm] h-[0.6pt] bg-[#D0D0D0] my-[0.8mm]" />
                    {(f.airline || f.flight_number) && (
                      <p className="text-[6.5pt] text-[#777]">{[f.airline, f.flight_number].filter(Boolean).join(' ')}</p>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-right">
                    {(f.arrival_date || f.arrival_time) && (
                      <p className="text-[11pt] font-bold text-[#111]">
                        {fmtDate(f.arrival_date || f.date) && <span className="text-[7pt] font-normal text-[#777]">{fmtDate(f.arrival_date || f.date)} · </span>}
                        {f.arrival_time || ''} {f.to_code || ''}
                      </p>
                    )}
                    <p className="text-[7pt] text-[#777]">{f.to_city || ''}</p>
                  </div>
                </div>
                {cabin && <p className="text-[7pt] text-[#555] mt-[1mm]">{cabin}</p>}
                {f.stopover_label && (
                  <div className="flex items-center gap-[1.5mm] bg-[#F7F7F7] border-[0.6pt] border-[#D0D0D0] rounded-[2mm] px-[3mm] py-[1.5mm] mt-[1.5mm]">
                    <Clock className="w-[3mm] h-[3mm] text-[#555] shrink-0" />
                    <p className="text-[7pt] text-[#555]">{f.stopover_label}</p>
                  </div>
                )}
                {bag && <p className="text-[6.5pt] text-[#777] mt-[1mm]">{bag}</p>}
              </div>
            )
          })}
        </div>
      ))}

      {allBaggage.length > 0 && (
        <div className="pt-[2mm] mt-[1mm] border-t-[0.6pt] border-[#D0D0D0]">
          <p className="text-[7.5pt] font-bold text-[#16845B] mb-[1mm]">
            Inclui {BAGGAGE_OPTIONS.filter(b => allBaggage.includes(b.key)).map(b => b.label.toLowerCase()).join(', ')}
          </p>
        </div>
      )}
    </CardShell>
  )
}

export function FlightsTextCard({ text }: { text: string }) {
  return (
    <CardShell>
      <CardHeader icon={Plane} title="Aéreo" />
      <p className="text-[8pt] whitespace-pre-wrap text-[#111]">{text}</p>
    </CardShell>
  )
}
