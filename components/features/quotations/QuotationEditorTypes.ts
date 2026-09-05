/**
 * Tipos de estado compartilhados do editor de cotação — extraídos de
 * QuotationEditor.tsx para serem usados também pelos componentes de grupo
 * (QuotationEditorProductsGroup.tsx etc). Pura movimentação de tipos, sem
 * mudança de forma.
 */

export type Lodging = { _key: string; name: string; check_in?: string | null; check_out?: string | null; check_in_time?: string | null; check_out_time?: string | null; room_category?: string | null; board?: string | null; star_rating?: number | null; description_html?: string | null; photos: string[]; lat?: number | null; lng?: number | null; tripadvisor_location_id?: string | null; tripadvisor_data?: any; is_alternative_option?: boolean; option_price_per_person_cents?: number | null; option_total_cents?: number | null }

export type Flight = {
  _key: string; leg_type: string; from_code?: string | null; from_city?: string | null; to_code?: string | null; to_city?: string | null;
  airline?: string | null; flight_number?: string | null;
  date?: string | null; departure_time?: string | null; arrival_date?: string | null; arrival_time?: string | null;
  duration_label?: string | null; stopover_label?: string | null; baggage: string[]; cabin_class?: string | null
}
export type Pin = { _key: string; label: string; type: string; lat?: number | null; lng?: number | null; _query?: string }

/** Dia de itinerário do cruzeiro — porto/data/horários de chegada e
 *  saída. Mesmo padrão de repeater dos demais (chave local + reorder). */
export type CruiseDay = { _key: string; day_number?: number | null; date?: string | null; port?: string | null; arrival?: string | null; departure?: string | null; note?: string | null }

/** Opção de cabine — cliente escolhe entre 2+ categorias de cabine pro
 *  mesmo cruzeiro, cada uma com seu próprio valor. */
export type CruiseCabinOption = {
  _key: string; label: string
  deck?: string | null; location?: string | null; view?: string | null
  price_cents: number | null
}

/** Cruzeiro — primeiro tipo de produto novo do Construtor de Viagens
 *  (ver actions/quotations.ts: ProductSchema/product_type='cruzeiro').
 *  Campos essenciais sempre visíveis; recomendados/avançados atrás de
 *  Disclosure, conforme níveis de informação do módulo. */
export type Cruise = {
  _key: string
  cruise_line?: string | null; ship_name?: string | null; itinerary_name?: string | null
  embark_date?: string | null; disembark_date?: string | null; duration_nights?: number | null
  embark_port?: string | null; disembark_port?: string | null
  pax_adults?: number | null; pax_children?: number | null; occupancy_label?: string | null
  cabin_category?: string | null; cabin_type?: string | null
  cabin_price_cents?: number | null; taxes_cents?: number | null; total_cents?: number | null
  // Opções de cabine — quando preenchido, o cliente escolhe entre elas (ver
  // Investimento na proposta pública/impressão: mostra "Cabine X = R$…" por
  // opção, com a mesma forma de pagamento pra todas). Deixa cabin_category/
  // cabin_price_cents acima como o valor "padrão" pra quando só há 1 opção.
  cabin_options?: CruiseCabinOption[]
  // recomendado
  cabin_number?: string | null; deck?: string | null; location?: string | null; view?: string | null; cabin_guaranteed?: boolean
  pkg_drinks?: string | null; pkg_drinks_upgrade_cents?: number | null
  pkg_internet?: string | null; pkg_restaurants?: string | null; pkg_gratuities?: string | null; pkg_others?: string | null
  extras_cents?: number | null; discount_cents?: number | null
  days: CruiseDay[]
  // avançado/interno — nunca aparece no público/PDF (ver internal_data)
  supplier?: string | null; fare_code?: string | null; cost_cents?: number | null; internal_notes?: string | null
}

/** Transfer/Seguro/Locação/Passeio — tipos "esqueleto" do Construtor de
 *  Viagens (produto_type já existe no banco desde a migração original;
 *  faltava só o editor). Campos alinhados ao que QuotationPrintView já lê
 *  de cada `data` (TransferCard/InsuranceCard/RentalCard/TourCard). */
export type Transfer = {
  _key: string
  origin?: string | null; destination?: string | null
  date?: string | null; time?: string | null
  vehicle?: string | null; pax?: string | null; transfer_type?: string | null
  round_trip?: boolean
  return_date?: string | null; return_time?: string | null
  notes?: string | null
}
export type Insurance = {
  _key: string
  insurer?: string | null; plan?: string | null; destination?: string | null
  date_start?: string | null; date_end?: string | null
  travelers?: string | null; coverage?: string | null
}
export type Tour = {
  _key: string
  name?: string | null; description?: string | null
  date?: string | null; duration_label?: string | null; includes?: string | null
}
export type Rental = {
  _key: string
  company?: string | null; vehicle_category?: string | null
  pickup_location?: string | null; dropoff_location?: string | null
  pickup_date?: string | null; dropoff_date?: string | null
  notes?: string | null
}

/** Estado "de topo" do editor (campos escalares da cotação) — o shape
 *  exato do `useState` de QuotationEditor.tsx. Compartilhado com os
 *  componentes de grupo extraídos (props `q`/`setQ`). */
export type QuotationTopState = {
  title: string; subtitle: string
  status: string
  contato_id: string | null
  client_name: string; client_whatsapp: string
  cover_image_url: string | null
  origin_label: string; origin_note: string
  destinations: { name: string; country: string }[]
  start_date: string; end_date: string
  pax_adults: number; pax_children: number
  children_ages: number[]
  occupancy_label: string
  intro_html: string; important_html: string; closing_html: string
  cancellation_html: string
  itinerary_html: string
  flights_html: string
  flight_fare_conditions: string[]
  tours_html: string
  included: string[]; not_included: string[]
  price_per_person_cents: number | null
  total_cents: number
  payment_conditions: { label: string; value: string }[]
  price_disclaimer: string
  validity_days: number
  operadora: string; commission_total_cents: number
  offer_published: boolean; offer_category: string
  signature_enabled: boolean
  signature_name: string
  signature_photo_url: string | null
  signature_message: string
  signature_bg_color: string
  signature_text_color: string
  footer_override: boolean
  footer_legal_name: string
  footer_logo_url: string | null
  footer_address: string
  footer_cnpj: string
  footer_cadastur: string
  footer_instagram_url: string
  footer_site_url: string
  footer_whatsapp_number: string
  footer_phone: string
  footer_email: string
}
