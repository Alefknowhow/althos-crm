import { createClient } from '@/lib/supabase/server'
import { isTravelNiche } from '@/lib/niche'

/**
 * Single niche-aware extension point for "sales" data on the dashboard and the
 * Insights IA tools.
 *
 * The generic `sales` table is the right source for most niches, but the travel
 * vertical records closed deals in `travel_sales` instead (different column
 * names + no per-row "completed" status — a travel sale row only exists once a
 * deal is won). Branching here keeps every consumer (dashboard widgets,
 * analytics tools) reading the correct table without each one re-deriving the
 * niche.
 *
 * Future niches that get their own sales table can extend `fetchNormalizedSales`
 * with another branch — callers don't need to change.
 */

export type NormalizedSale = {
  amount_cents: number
  /** ISO timestamp (travel) or YYYY-MM-DD (generic). Safe for day-bucketing. */
  date: string
  seller_id: string | null
}

type Supa = ReturnType<typeof createClient>

const nicheCache = new Map<string, string | null>()

/** Resolve an org's niche from its id (memoised per request lifetime). */
export async function resolveOrgNiche(supabase: Supa, orgId: string): Promise<string | null> {
  if (nicheCache.has(orgId)) return nicheCache.get(orgId) ?? null
  const { data } = await supabase
    .from('organizations')
    .select('niche')
    .eq('id', orgId)
    .maybeSingle()
  const niche = (data as any)?.niche ?? null
  nicheCache.set(orgId, niche)
  return niche
}

export async function isOrgTravelNiche(supabase: Supa, orgId: string): Promise<boolean> {
  return isTravelNiche(await resolveOrgNiche(supabase, orgId))
}

/**
 * Fetch an org's sales since `since`, normalized to a common shape.
 *
 * - Travel niche → `travel_sales` (total_cents, created_at, created_by). Every
 *   row is a won deal; rows with status `canceled` are excluded.
 * - Otherwise → `sales` (amount_cents, sale_date, seller_id). `onlyCompleted`
 *   narrows to status `completed`; by default cancelled sales are excluded.
 */
export async function fetchNormalizedSales(
  supabase: Supa,
  orgId: string,
  opts: { since?: Date; onlyCompleted?: boolean } = {},
): Promise<NormalizedSale[]> {
  const since = opts.since ?? new Date(0)

  if (await isOrgTravelNiche(supabase, orgId)) {
    const { data } = await supabase
      .from('travel_sales')
      .select('total_cents, created_at, created_by, status')
      .eq('organization_id', orgId)
      .gte('created_at', since.toISOString())
    return (data || [])
      .filter((r: any) => r.status !== 'canceled')
      .map((r: any) => ({
        amount_cents: r.total_cents || 0,
        date: r.created_at,
        seller_id: r.created_by ?? null,
      }))
  }

  let q = supabase
    .from('sales')
    .select('amount_cents, sale_date, seller_id, status')
    .eq('organization_id', orgId)
    .gte('sale_date', since.toISOString().slice(0, 10))
  q = opts.onlyCompleted ? q.eq('status', 'completed') : q.neq('status', 'canceled')

  const { data } = await q
  return (data || []).map((r: any) => ({
    amount_cents: r.amount_cents || 0,
    date: r.sale_date,
    seller_id: r.seller_id ?? null,
  }))
}
