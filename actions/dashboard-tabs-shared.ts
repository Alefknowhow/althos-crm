import { createClient } from '@/lib/supabase/server'
import { isOrgTravelNiche } from '@/lib/dashboard/sales-source'

/**
 * Shared helper for actions/dashboard-tabs-*.ts (dashboard-tabs.ts split
 * by concern). No 'use server' here: this is a plain helper called from
 * server action files, not an action invoked directly from the client.
 */

type SaleWithContact = { contato_id: string | null; amount_cents: number; commission_cents: number; sale_date: string }

export async function fetchCompletedSalesWithContact(orgId: string): Promise<SaleWithContact[]> {
  const supabase = createClient()
  if (await isOrgTravelNiche(supabase, orgId)) {
    const { data } = await supabase
      .from('travel_sales')
      .select('contato_id, total_cents, commission_cents, created_at, status')
      .eq('organization_id', orgId)
      .neq('status', 'cancelado')
    return ((data || []) as any[]).map(r => ({ contato_id: r.contato_id, amount_cents: r.total_cents || 0, commission_cents: r.commission_cents || 0, sale_date: r.created_at }))
  }
  const { data } = await supabase
    .from('sales')
    .select('contato_id, amount_cents, sale_date, status')
    .eq('organization_id', orgId)
    .neq('status', 'cancelled')
  return ((data || []) as any[]).map(r => ({ contato_id: r.contato_id, amount_cents: r.amount_cents || 0, commission_cents: 0, sale_date: r.sale_date }))
}
