import { hasHtml } from './PublicQuotationHelpers'
import type { PublicQuotation, QuotationDay, QuotationLodging, QuotationFlight, QuotationCruise, QuotationOtherProduct, QuotationPin } from './PublicQuotationTypes'

/**
 * Numeração dinâmica dos blocos visíveis da proposta pública — calculada
 * uma vez, na mesma ordem em que os blocos aparecem no JSX de
 * PublicQuotationView (idêntico ao contador `num()` incremental que existia
 * antes da divisão em sub-componentes). Extraído só pra reduzir o tamanho
 * do arquivo principal, sem mudança de comportamento.
 */
export function computeQuotationBlockNumbers(data: PublicQuotation, params: {
  lodgings: QuotationLodging[]; flights: QuotationFlight[]; cruises: QuotationCruise[]
  transfers: QuotationOtherProduct[]; insurances: QuotationOtherProduct[]; tours: QuotationOtherProduct[]; rentals: QuotationOtherProduct[]
  pins: QuotationPin[]; days: QuotationDay[]; included: string[]; notIncluded: string[]
}): Record<string, string> {
  const { lodgings, flights, cruises, transfers, insurances, tours, rentals, pins, days, included, notIncluded } = params
  let n = 0
  const next = () => String(++n).padStart(2, '0')
  const out: Record<string, string> = {}
  if (lodgings.length > 0) out.lodging = next()
  if (flights.length > 0 || hasHtml(data.flights_html)) out.flights = next()
  if (cruises.length > 0) out.cruises = next()
  if (transfers.length > 0) out.transfers = next()
  if (insurances.length > 0) out.insurances = next()
  if (tours.length > 0) out.tours = next()
  if (rentals.length > 0) out.rentals = next()
  if (pins.length > 0) out.map = next()
  if (hasHtml(data.itinerary_html) || days.length > 0) out.itinerary = next()
  if (hasHtml(data.tours_html)) out.toursHtml = next()
  if (hasHtml(data.important_html)) out.important = next()
  if (included.length > 0 || notIncluded.length > 0) out.includes = next()
  if (hasHtml(data.cancellation_html)) out.cancellation = next()
  return out
}
