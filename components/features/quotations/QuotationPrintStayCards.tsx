'use client'

/**
 * Hotel + cruise cards for QuotationPrintView's document.
 * Split out of QuotationPrintCards.tsx.
 */

import { Building2, Ship, ArrowUpRight } from 'lucide-react'
import { fmtDate, fmtCurrency, hasHtml, Rich, InfoField, CardHeader, CardShell, type Product } from './QuotationPrintCards'

function nightsBetween(a?: string | null, b?: string | null): number | null {
  if (!a || !b) return null
  const d1 = new Date(a.slice(0, 10) + 'T12:00:00')
  const d2 = new Date(b.slice(0, 10) + 'T12:00:00')
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return null
  const n = Math.round((d2.getTime() - d1.getTime()) / 86400000)
  return n > 0 ? n : null
}

export function HotelCard({ p }: { p: Product }) {
  const d = p.data
  const nights = nightsBetween(p.date_start, p.date_end)
  const address = d.tripadvisor_data?.address as string | undefined
  return (
    <CardShell>
      <CardHeader icon={Building2} title="Hospedagem" />
      <div className="flex items-center gap-[1.5mm] mb-[1mm]">
        <p className="text-[11pt] font-bold text-[#111]">{p.name || 'Hospedagem'}</p>
        {d.star_rating > 0 && <span className="text-[8pt] text-[#C9A227]">{'★'.repeat(d.star_rating)}</span>}
      </div>
      {address && <p className="text-[7pt] text-[#777] mb-[2mm]">{address}</p>}
      <div className="grid grid-cols-4 gap-x-[3mm] gap-y-[2mm] mb-[2mm]">
        <InfoField label="Check-in" value={fmtDate(p.date_start)} />
        <InfoField label="Horário" value={d.check_in_time} />
        <InfoField label="Check-out" value={fmtDate(p.date_end)} />
        <InfoField label="Horário" value={d.check_out_time} />
      </div>
      <div className="grid grid-cols-3 gap-x-[3mm] gap-y-[2mm]">
        <InfoField label="Noites" value={nights ? `${nights} noite${nights === 1 ? '' : 's'}` : null} />
        <InfoField label="Quarto" value={d.room_category} />
        <InfoField label="Regime" value={d.board} />
      </div>
      {hasHtml(d.description_html) && (
        <Rich html={d.description_html} className="text-[7.5pt] leading-snug text-[#555] mt-[2mm] pt-[2mm] border-t-[0.6pt] border-[#D0D0D0] [&_p]:mb-[1mm]" />
      )}
    </CardShell>
  )
}

export function CruiseCard({ p }: { p: Product }) {
  const d = p.data
  const baseCabinLabel = [d.cabin_category, d.cabin_type].filter(Boolean).join(' — ') || null
  const cabinOptions: { label: string; deck?: string | null; location?: string | null; view?: string | null; price_cents?: number | null }[] = d.cabin_options || []
  const paxLine = d.pax_adults
    ? `${d.pax_adults} adulto${d.pax_adults === 1 ? '' : 's'}${d.pax_children ? ` · ${d.pax_children} criança${d.pax_children === 1 ? '' : 's'}` : ''}`
    : null
  const packageParts = [
    d.pkg_drinks && `(Pacote de bebidas) ${d.pkg_drinks}`,
    d.pkg_internet && `(Internet) ${d.pkg_internet}`,
    d.pkg_restaurants && `(Restaurantes) ${d.pkg_restaurants}`,
    d.pkg_gratuities && `(Taxas de serviço) ${d.pkg_gratuities}`,
    d.pkg_others && `(Outros) ${d.pkg_others}`,
  ].filter(Boolean)
  return (
    <CardShell>
      <CardHeader icon={Ship} title="Cruzeiro" />
      <p className="text-[11pt] font-bold text-[#111] mb-[1mm]">{p.name || d.ship_name || d.cruise_line || 'Cruzeiro'}</p>
      {d.itinerary_name && <p className="text-[8pt] text-[#555] mb-[2.5mm]">{d.itinerary_name}</p>}
      <div className="grid grid-cols-3 gap-x-[3mm] gap-y-[2mm] mb-[2mm]">
        <InfoField label="Embarque" value={[d.embark_port, fmtDate(d.embark_date)].filter(Boolean).join(' — ') || null} />
        <InfoField label="Desembarque" value={[d.disembark_port, fmtDate(d.disembark_date)].filter(Boolean).join(' — ') || null} />
        <InfoField label="Noites" value={d.duration_nights ? `${d.duration_nights} noites` : null} />
      </div>
      <div className="grid grid-cols-2 gap-x-[3mm] gap-y-[2mm]">
        <InfoField label="Cabine" value={baseCabinLabel} />
        <InfoField label="Passageiros" value={paxLine} />
      </div>

      {cabinOptions.length > 0 && (
        <div className="mt-[2.5mm]">
          <p className="text-[6.5pt] text-[#777] mb-[1.5mm]">
            Preço com base na cabine {baseCabinLabel || 'mais econômica'} — confira as opções de upgrade abaixo.
          </p>
          {cabinOptions.filter(o => o.label).map((o, i) => (
            <div key={i} className="flex items-center gap-[1.5mm] bg-[#F7F7F7] border-[0.6pt] border-[#D0D0D0] rounded-[2mm] px-[3mm] py-[1.5mm] mb-[1mm] last:mb-0">
              <ArrowUpRight className="w-[3mm] h-[3mm] text-[#555] shrink-0" />
              <p className="text-[7pt] text-[#555]">
                <span className="font-semibold text-[#111]">{o.label}</span>
                {[o.deck && `Deck ${o.deck}`, o.location, o.view].filter(Boolean).length > 0
                  ? ` — ${[o.deck && `Deck ${o.deck}`, o.location, o.view].filter(Boolean).join(' · ')}` : ''}
                {o.price_cents ? ` — upgrade ${fmtCurrency(o.price_cents)}` : ''}
              </p>
            </div>
          ))}
        </div>
      )}

      {d.pkg_drinks_upgrade_cents > 0 && (
        <div className="flex items-center gap-[1.5mm] bg-[#F7F7F7] border-[0.6pt] border-[#D0D0D0] rounded-[2mm] px-[3mm] py-[1.5mm] mt-[1mm]">
          <ArrowUpRight className="w-[3mm] h-[3mm] text-[#555] shrink-0" />
          <p className="text-[7pt] text-[#555]">
            <span className="font-semibold text-[#111]">Pacote de bebidas superior</span> — upgrade {fmtCurrency(d.pkg_drinks_upgrade_cents)}
          </p>
        </div>
      )}

      {packageParts.length > 0 && (
        <p className="text-[7pt] text-[#777] mt-[2mm] pt-[2mm] border-t-[0.6pt] border-[#D0D0D0]">
          {packageParts.join(' · ')}
        </p>
      )}
    </CardShell>
  )
}
