/**
 * Pure mapping helper shared by the auto-creation-on-won path
 * (travel-sales-won.ts) and the manual "Nova venda" flow
 * (travel-sales-create.ts). Not a server action — moved out of
 * actions/travel-sales-create.ts because a 'use server' file can only
 * export async functions; this is a plain sync transform with no I/O.
 */
export function mapProposalToSaleFields(proposal: any): Record<string, any> {
  const destination = (proposal.destinations || [])
    .map((d: any) => d?.name).filter(Boolean).join(', ') || null
  const hotelName = (proposal.hotels || [])
    .map((h: any) => h?.name).filter(Boolean).join(', ') || null
  const airlines = Array.from(new Set((proposal.flights || [])
    .map((f: any) => f?.airline).filter(Boolean)))
  const airline = airlines.length ? airlines.join(', ') : null
  const services = Object.entries(proposal.services || {})
    .filter(([, v]: any) => v?.enabled)
    .map(([k]) => k)
  const methods: string[] = proposal.payment?.methods || []

  let negotiationDays: number | null = null
  if (proposal.created_at) {
    const ms = Date.now() - new Date(proposal.created_at).getTime()
    negotiationDays = Math.max(0, Math.round(ms / 86400000))
  }

  return {
    client_name: proposal.client_name,
    destination,
    departure_date: proposal.start_date,
    return_date: proposal.end_date,
    negotiation_days: negotiationDays,
    total_cents: proposal.total_cents || 0,
    hotel_name: hotelName,
    airline,
    services,
    payment_method: methods.join(', ') || null,
    travelers: Array.isArray(proposal.travelers) ? proposal.travelers : [],
    travelers_note: proposal.travelers_note ?? null,
  }
}
