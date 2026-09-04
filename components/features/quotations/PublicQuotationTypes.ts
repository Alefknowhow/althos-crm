/**
 * Types for the public quotation view (the RPC contract). Split out of
 * PublicQuotationView.tsx.
 */

export type QuotationOrg = {
  legal_name?: string | null
  brand_logo_url?: string | null
  brand_accent?: string | null
  instagram_url?: string | null
  site_url?: string | null
  terms_url?: string | null
  privacy_url?: string | null
  whatsapp_number?: string | null
  city_state?: string | null
  cnpj?: string | null
  cadastur?: string | null
  phone?: string | null
  email?: string | null
}

export type QuotationLodging = {
  id?: string
  name?: string | null
  check_in?: string | null
  check_out?: string | null
  check_in_time?: string | null
  check_out_time?: string | null
  star_rating?: number | null
  room_category?: string | null
  board?: string | null
  description_html?: string | null
  photos?: string[]
  lat?: number | null
  lng?: number | null
  tripadvisor_data?: {
    rating?: number
    reviews_count?: number
    url?: string
    photos?: string[]
    lat?: number
    lng?: number
    address?: string
  } | null
  /** Opção alternativa: quando 2+ hospedagens são "ou/ou" (não um circuito),
   *  cada opção carrega seu próprio preço, exibido em Investimento. */
  is_alternative_option?: boolean
  option_price_per_person_cents?: number | null
  option_total_cents?: number | null
}

export type QuotationFlight = {
  id?: string
  leg_type?: string | null
  from_code?: string | null
  from_city?: string | null
  to_code?: string | null
  to_city?: string | null
  airline?: string | null
  flight_number?: string | null
  date?: string | null
  departure_time?: string | null
  arrival_date?: string | null
  arrival_time?: string | null
  duration_label?: string | null
  stopover_label?: string | null
  baggage?: string[]
  cabin_class?: string | null
}

export type QuotationDay = {
  id?: string
  day_label?: string | null
  date?: string | null
  title?: string | null
  items?: string[]
}

export type QuotationPin = { label?: string; type?: string; lat: number; lng: number }

/** Cruzeiro — primeiro tipo de produto do Construtor de Viagens além de
 *  Aéreo/Hospedagem (ver quotation_products, product_type='cruzeiro').
 *  `data` carrega os campos específicos (mesmo shape gravado pelo editor,
 *  QuotationEditor.tsx/type Cruise) — só o essencial é lido aqui. */
export type QuotationOtherProduct = {
  id?: string
  product_type: 'transfer' | 'passeio' | 'seguro' | 'locacao' | string
  name?: string | null
  summary?: string | null
  date_start?: string | null
  date_end?: string | null
  data?: Record<string, any>
}

export type QuotationCruise = {
  id?: string
  name?: string | null
  summary?: string | null
  date_start?: string | null
  date_end?: string | null
  price_cents?: number | null
  data?: {
    cruise_line?: string | null
    ship_name?: string | null
    itinerary_name?: string | null
    embark_port?: string | null
    disembark_port?: string | null
    duration_nights?: number | null
    cabin_category?: string | null
    cabin_type?: string | null
    pkg_drinks?: string | null
    pkg_internet?: string | null
    pkg_restaurants?: string | null
    days?: { day_number?: number | null; date?: string | null; port?: string | null; arrival?: string | null; departure?: string | null }[]
  } | null
}

export type PublicQuotation = {
  id?: string
  status?: string
  expired?: boolean
  client_name?: string | null
  title?: string | null
  subtitle?: string | null
  cover_image_url?: string | null
  origin_label?: string | null
  origin_note?: string | null
  destinations?: { name?: string; country?: string }[]
  departure_date?: string | null
  return_date?: string | null
  pax_adults?: number
  pax_children?: number
  children_ages?: number[]
  occupancy_label?: string | null
  intro_html?: string | null
  important_html?: string | null
  closing_html?: string | null
  cancellation_html?: string | null
  itinerary_html?: string | null
  flights_html?: string | null
  tours_html?: string | null
  included?: string[]
  not_included?: string[]
  price_per_person_cents?: number | null
  total_cents?: number | null
  currency?: string | null
  payment_conditions?: { label?: string; value?: string }[]
  price_disclaimer?: string | null
  quoted_at?: string | null
  validity_days?: number | null
  signature_enabled?: boolean | null
  signature_name?: string | null
  signature_photo_url?: string | null
  signature_message?: string | null
  signature_bg_color?: string | null
  signature_text_color?: string | null
  lodgings?: QuotationLodging[]
  flights?: QuotationFlight[]
  cruises?: QuotationCruise[]
  /** Transfer/Passeio/Seguro/Locação — tipos "esqueleto" do Construtor de
   *  Viagens (ver quotation_products, product_type in ('transfer','passeio','seguro','locacao')). */
  other_products?: QuotationOtherProduct[]
  itinerary_days?: QuotationDay[]
  map_pins?: QuotationPin[]
  org?: QuotationOrg
}
