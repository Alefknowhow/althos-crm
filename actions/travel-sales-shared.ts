/**
 * Shared types + pick() helper for the actions/travel-sales-*.ts modules
 * (travel-sales.ts split by concern). No 'use server' here: these are
 * plain types/helpers, not actions invoked directly from the client, and
 * a 'use server' file may only export async functions.
 */

export type TravelSaleRow = {
  id: string
  sale_number: string
  organization_id: string
  contato_id: string | null
  proposal_id: string | null
  created_by: string | null
  status: string
  client_name: string | null
  destination: string | null
  departure_date: string | null
  return_date: string | null
  negotiation_days: number | null
  total_cents: number
  hotel_name: string | null
  airline: string | null
  operator: string | null
  services: any[]
  included_items: string[]
  vouchers: any[]
  travelers: any[]
  travelers_note: string | null
  payment_method: string | null
  package_locator: string | null
  air_locator: string | null
  hotel_locator: string | null
  airline_checkin_url: string | null
  commission_cents: number
  /** Parte da comissão retida na fonte (ex.: entrada à vista) — lançada em
   * Financeiro na data da venda, em vez de esperar o repasse da operadora. */
  retained_commission_cents: number | null
  notes: string | null
  tasks_generated_at: string | null
  contrato_gerado_at: string | null
  contrato_assinado_at: string | null
  voucher_entregue_at: string | null
  embarque_realizado_at: string | null
  posvenda_concluido_at: string | null
  cancellation_policy: string | null
  important_info: string | null
  service_info: string | null
  flights: FlightSegment[]
  created_at: string
  updated_at: string
}

export type FlightSegment = {
  companhia?: string | null
  numero?: string | null
  data?: string | null
  origem?: string | null
  destino?: string | null
  horario?: string | null
  sentido?: 'ida' | 'volta' | null
}

const WRITABLE = [
  'status', 'client_name', 'destination', 'departure_date', 'return_date',
  'negotiation_days', 'total_cents', 'hotel_name', 'airline', 'operator', 'services',
  'included_items', 'vouchers', 'travelers', 'travelers_note',
  'payment_method', 'package_locator', 'air_locator', 'hotel_locator', 'airline_checkin_url',
  'commission_cents', 'retained_commission_cents', 'notes', 'cancellation_policy', 'important_info', 'service_info', 'flights',
] as const

export function pick(input: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {}
  for (const k of WRITABLE) if (k in input) out[k] = input[k]
  // Nunca deixa reter mais do que a comissão total — trava aqui pra não
  // depender só da checagem no client.
  if ('retained_commission_cents' in out) {
    const total = 'commission_cents' in out ? Number(out.commission_cents) : Number(input.commission_cents ?? 0)
    const r = out.retained_commission_cents
    out.retained_commission_cents = r == null || r === '' ? null : Math.max(0, Math.min(Math.round(Number(r) || 0), Math.round(total) || 0))
  }
  for (const k of ['total_cents', 'commission_cents', 'negotiation_days'] as const) {
    if (k in out && out[k] != null && out[k] !== '') {
      const n = Number(out[k])
      out[k] = Number.isFinite(n) ? Math.round(n) : 0
    } else if (k in out) {
      out[k] = null
    }
  }
  for (const k of ['departure_date', 'return_date'] as const) {
    if (k in out && !out[k]) out[k] = null
  }
  return out
}
