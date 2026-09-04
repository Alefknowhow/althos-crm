'use server'

/**
 * Search helper for the "Relacionado a" combobox (TaskDialog / EditSheet).
 * Split out of actions/tasks.ts.
 */

import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/supabase/types'

export type RelatedEntityOption = { id: string; label: string }

async function contatoNamesFor(supabase: ReturnType<typeof createClient>, ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const uniq = Array.from(new Set(ids.filter(Boolean))) as string[]
  if (uniq.length === 0) return new Map()
  const { data } = await supabase.from('contatos').select('id, name').in('id', uniq)
  return new Map((data || []).map((c: any) => [c.id, c.name]))
}

/** Busca registros de um tipo de entidade pra popular o combobox "Relacionado
 *  a" (TaskDialog / EditSheet). Uniforme pra todos os tipos, mesmo os que
 *  internamente mapeiam pra contato_id/sale_id (contato/reserva) — mantém o
 *  componente de UI simples, sem casos especiais por tipo. */
export async function searchRelatedEntities(orgSlug: string, entityType: string, query: string): Promise<RelatedEntityOption[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const q = (query || '').trim()

  if (entityType === 'contato') {
    let sel = supabase.from('contatos').select('id, name').eq('organization_id', org.id).limit(20)
    if (q) sel = sel.ilike('name', `%${q}%`)
    const { data } = await sel
    return (data || []).map((r: any) => ({ id: r.id, label: r.name }))
  }

  if (entityType === 'reserva') {
    let sel = supabase.from('travel_sales').select('id, client_name, destination, sale_number, package_locator').eq('organization_id', org.id).limit(20)
    if (q) sel = sel.or(`client_name.ilike.%${q}%,destination.ilike.%${q}%,sale_number.ilike.%${q}%,package_locator.ilike.%${q}%`)
    const { data } = await sel
    return (data || []).map((r: any) => {
      const loc = r.package_locator || r.sale_number
      return {
        id: r.id,
        label: loc ? `#${loc} — ${r.client_name || r.destination || ''}` : (r.client_name || r.destination || 'Reserva'),
      }
    })
  }

  if (entityType === 'travel_proposal') {
    let sel = supabase.from('travel_proposals').select('id, title, client_name').eq('organization_id', org.id).limit(20)
    if (q) sel = sel.or(`title.ilike.%${q}%,client_name.ilike.%${q}%`)
    const { data } = await sel
    return (data || []).map((r: any) => ({ id: r.id, label: [r.title, r.client_name].filter(Boolean).join(' — ') || 'Cotação' }))
  }

  if (entityType === 'appointment') {
    let sel = supabase.from('appointments').select('id, guest_name, start_time').eq('organization_id', org.id).order('start_time', { ascending: false }).limit(20)
    if (q) sel = sel.ilike('guest_name', `%${q}%`)
    const { data } = await sel
    return (data || []).map((r: any) => ({
      id: r.id,
      label: `${r.guest_name || 'Agendamento'}${r.start_time ? ' — ' + new Date(r.start_time).toLocaleDateString('pt-BR') : ''}`,
    }))
  }

  if (entityType === 'sale') {
    const { data } = await supabase.from('sales').select('id, amount_cents, sale_date, contato_id').eq('organization_id', org.id).order('sale_date', { ascending: false }).limit(50)
    const rows = (data || []) as any[]
    const names = await contatoNamesFor(supabase, rows.map(r => r.contato_id))
    let out = rows.map(r => ({ id: r.id, label: `${names.get(r.contato_id) || 'Venda'} — R$ ${((r.amount_cents || 0) / 100).toFixed(2)}` }))
    if (q) out = out.filter(o => o.label.toLowerCase().includes(q.toLowerCase()))
    return out.slice(0, 20)
  }

  if (entityType === 'property_deal') {
    const { data } = await supabase.from('property_deals').select('id, deal_type, contato_id').eq('organization_id', org.id).limit(50)
    const rows = (data || []) as any[]
    const names = await contatoNamesFor(supabase, rows.map(r => r.contato_id))
    let out = rows.map(r => ({ id: r.id, label: `${names.get(r.contato_id) || 'Negócio'} (${r.deal_type === 'locacao' ? 'Locação' : 'Venda'})` }))
    if (q) out = out.filter(o => o.label.toLowerCase().includes(q.toLowerCase()))
    return out.slice(0, 20)
  }

  if (entityType === 'property_proposal') {
    const { data } = await supabase.from('property_proposals').select('id, operation_type, contato_id').eq('organization_id', org.id).limit(50)
    const rows = (data || []) as any[]
    const names = await contatoNamesFor(supabase, rows.map(r => r.contato_id))
    let out = rows.map(r => ({ id: r.id, label: `${names.get(r.contato_id) || 'Proposta'} (${r.operation_type === 'locacao' ? 'Locação' : 'Venda'})` }))
    if (q) out = out.filter(o => o.label.toLowerCase().includes(q.toLowerCase()))
    return out.slice(0, 20)
  }

  return []
}
