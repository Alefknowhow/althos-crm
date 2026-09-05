import { computeFlightDuration } from './QuotationEditorFields'
import type {
  Lodging, Flight, Pin, Cruise, Transfer, Insurance, Tour, Rental,
} from './QuotationEditorTypes'

/**
 * Monta o payload de saveQuotation a partir do estado local do editor —
 * pura função de transformação, extraída do hook de estado só pra reduzir
 * o tamanho do arquivo (nenhuma mudança de comportamento).
 */
export function buildQuotationPayload(
  q: any,
  isOffer: boolean,
  products: {
    lodgings: Lodging[]; flights: Flight[]; cruises: Cruise[]; transfers: Transfer[]
    insurances: Insurance[]; tours: Tour[]; rentals: Rental[]; pins: Pin[]
  },
) {
  const { lodgings, flights, cruises, transfers, insurances, tours, rentals, pins } = products
  return {
    title: q.title || null, subtitle: q.subtitle || null, status: q.status as any,
    contato_id: q.contato_id,
    client_name: q.client_name || null, client_whatsapp: q.client_whatsapp || null,
    cover_image_url: q.cover_image_url || null,
    origin_label: q.origin_label || null, origin_note: q.origin_note || null,
    destinations: q.destinations.filter((d: any) => d.name),
    start_date: q.start_date || null, end_date: q.end_date || null,
    pax_adults: q.pax_adults, pax_children: q.pax_children, children_ages: q.children_ages,
    occupancy_label: q.occupancy_label || null,
    intro_html: q.intro_html || null, important_html: q.important_html || null, closing_html: q.closing_html || null,
    cancellation_html: q.cancellation_html || null,
    itinerary_html: q.itinerary_html || null,
    flights_html: q.flights_html || null,
    flight_fare_conditions: q.flight_fare_conditions,
    tours_html: q.tours_html || null,
    included: q.included.filter(Boolean), not_included: q.not_included.filter(Boolean),
    price_per_person_cents: q.price_per_person_cents, total_cents: q.total_cents,
    payment_conditions: q.payment_conditions.filter((p: any) => p.label || p.value),
    price_disclaimer: q.price_disclaimer || null, validity_days: q.validity_days,
    operadora: q.operadora || null, commission_total_cents: q.commission_total_cents,
    signature_enabled: q.signature_enabled,
    signature_name: q.signature_name || null,
    signature_photo_url: q.signature_photo_url || null,
    signature_message: q.signature_message || null,
    signature_bg_color: q.signature_bg_color || null,
    signature_text_color: q.signature_text_color || null,
    footer_override: q.footer_override,
    footer_legal_name: q.footer_legal_name || null,
    footer_logo_url: q.footer_logo_url || null,
    footer_address: q.footer_address || null,
    footer_cnpj: q.footer_cnpj || null,
    footer_cadastur: q.footer_cadastur || null,
    footer_instagram_url: q.footer_instagram_url || null,
    footer_site_url: q.footer_site_url || null,
    footer_whatsapp_number: q.footer_whatsapp_number || null,
    footer_phone: q.footer_phone || null,
    footer_email: q.footer_email || null,
    ...(isOffer ? { offer_published: q.offer_published, offer_category: q.offer_category || null } : {}),
    products: [
      ...lodgings.map(({ _key, name, check_in, check_out, ...rest }) => ({
        product_type: 'hospedagem' as const,
        name: name || null,
        date_start: check_in || null, date_end: check_out || null,
        price_cents: rest.option_total_cents ?? null,
        data: { check_in, check_out, ...rest },
        internal_data: {},
      })),
      ...flights.map(({ _key, ...f }) => ({
        product_type: 'aereo' as const,
        name: [f.from_city || f.from_code, f.to_city || f.to_code].filter(Boolean).join(' → ') || null,
        date_start: f.date || null, date_end: f.arrival_date || f.date || null,
        price_cents: null,
        data: { ...f, duration_label: computeFlightDuration(f) || f.duration_label, baggage: f.baggage as any, cabin_class: (f.cabin_class || null) as any },
        internal_data: {},
      })),
      ...cruises.map(({ _key, days, cabin_options, total_cents, supplier, fare_code, cost_cents, internal_notes, ...c }) => ({
        product_type: 'cruzeiro' as const,
        name: c.ship_name || c.cruise_line || null,
        summary: [c.itinerary_name, c.duration_nights ? `${c.duration_nights} noites` : null].filter(Boolean).join(' · ') || null,
        date_start: c.embark_date || null, date_end: c.disembark_date || null,
        price_cents: total_cents ?? null,
        data: { ...c, total_cents, days: days.map(({ _key: __k, ...d }: any) => d), cabin_options: (cabin_options || []).map(({ _key: __k, ...o }: any) => o).filter((o: any) => o.label || o.price_cents) },
        internal_data: { supplier, fare_code, cost_cents, internal_notes },
      })),
      ...transfers.map(({ _key, ...t }) => ({
        product_type: 'transfer' as const,
        name: [t.origin, t.destination].filter(Boolean).join(' → ') || null,
        date_start: t.date || null, date_end: null,
        price_cents: null,
        data: { ...t },
        internal_data: {},
      })),
      ...insurances.map(({ _key, ...s }) => ({
        product_type: 'seguro' as const,
        name: s.insurer || null,
        date_start: s.date_start || null, date_end: s.date_end || null,
        price_cents: null,
        data: { ...s },
        internal_data: {},
      })),
      ...tours.map(({ _key, name, description, ...t }) => ({
        product_type: 'passeio' as const,
        name: name || null,
        summary: description || null,
        date_start: t.date || null, date_end: null,
        price_cents: null,
        data: { name, ...t },
        internal_data: {},
      })),
      ...rentals.map(({ _key, ...r }) => ({
        product_type: 'locacao' as const,
        name: [r.company, r.vehicle_category].filter(Boolean).join(' — ') || null,
        date_start: r.pickup_date || null, date_end: r.dropoff_date || null,
        price_cents: null,
        data: { ...r },
        internal_data: {},
      })),
    ],
    map_pins: pins.filter(p => p.lat != null && p.lng != null).map(p => ({ label: p.label, type: p.type as any, lat: p.lat!, lng: p.lng! })),
  }
}
