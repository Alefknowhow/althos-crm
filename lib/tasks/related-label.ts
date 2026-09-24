/**
 * Resolve o rótulo de exibição de "Relacionado a" pra um lote de tasks —
 * contato (leads), reserva (sale_id) ou related_entity_type/id (cotação,
 * agendamento, venda genérica, negócio/proposta imobiliária). Compartilhado
 * entre a página de Tarefas (app/[orgSlug]/agenda/tarefas) e
 * listTasksForProject (Agenda → Projetos, issue #17) — extraído pra não
 * duplicar essa resolução em N tabelas toda vez que uma tela nova lista
 * tasks com o vínculo "Relacionado a" completo (achado na revisão do PR #55:
 * listTasksForProject só resolvia contato, perdendo reserva/related_entity_*
 * e fazendo o EditSheet zerar esses vínculos ao salvar).
 */

import { createClient } from '@/lib/supabase/server'

export type RelatedRef = { type: string; label: string } | null

const RELATED_LABELS: Record<string, string> = {
  travel_proposal: 'Cotação',
  appointment: 'Agendamento',
  sale: 'Venda',
  property_deal: 'Negócio imobiliário',
  property_proposal: 'Proposta imobiliária',
}

type TaskRelatedRow = {
  leads?: { id: string; name: string } | { id: string; name: string }[] | null
  sale_id?: string | null
  related_entity_type?: string | null
  related_entity_id?: string | null
}

async function contatoNamesFor(supabase: ReturnType<typeof createClient>, ids: string[]) {
  if (ids.length === 0) return new Map<string, string>()
  const { data } = await supabase.from('contatos').select('id, name').in('id', Array.from(new Set(ids)))
  return new Map((data || []).map((c: any) => [c.id, c.name]))
}

/** Resolve os rótulos de `sale_id`/`related_entity_*` presentes em `rows` —
 *  não toca em `leads` (contato), que já vem pronto do join `leads:contatos(id, name)`. */
export async function resolveTaskRelatedLabels(supabase: ReturnType<typeof createClient>, rows: TaskRelatedRow[]) {
  const saleIds = Array.from(new Set(rows.filter(r => r.sale_id).map(r => r.sale_id as string)))
  const saleLabel = new Map<string, string>()
  if (saleIds.length > 0) {
    const { data } = await supabase.from('travel_sales').select('id, client_name, destination, sale_number, package_locator').in('id', saleIds)
    for (const s of data || []) {
      const loc = s.package_locator || s.sale_number
      saleLabel.set(s.id, loc ? `#${loc} — ${s.client_name || s.destination || ''}` : (s.client_name || s.destination || 'Reserva'))
    }
  }

  const idsByType: Record<string, string[]> = {}
  for (const r of rows) {
    if (r.related_entity_type && r.related_entity_id) {
      (idsByType[r.related_entity_type] ??= []).push(r.related_entity_id)
    }
  }

  const relatedLabel = new Map<string, string>() // key: `${type}:${id}`

  if (idsByType.travel_proposal?.length) {
    const { data } = await supabase.from('travel_proposals').select('id, title, client_name').in('id', Array.from(new Set(idsByType.travel_proposal)))
    for (const p of data || []) relatedLabel.set(`travel_proposal:${p.id}`, [p.title, p.client_name].filter(Boolean).join(' — ') || 'Cotação')
  }
  if (idsByType.appointment?.length) {
    const { data } = await supabase.from('appointments').select('id, guest_name, start_time').in('id', Array.from(new Set(idsByType.appointment)))
    for (const a of data || []) relatedLabel.set(`appointment:${a.id}`, `${a.guest_name || 'Agendamento'}${a.start_time ? ' — ' + new Date(a.start_time).toLocaleDateString('pt-BR') : ''}`)
  }
  if (idsByType.sale?.length) {
    const ids = Array.from(new Set(idsByType.sale))
    const { data } = await supabase.from('sales').select('id, amount_cents, contato_id').in('id', ids)
    const names = await contatoNamesFor(supabase, (data || []).map((s: any) => s.contato_id))
    for (const s of data || []) relatedLabel.set(`sale:${s.id}`, `${names.get(s.contato_id) || 'Venda'} — R$ ${((s.amount_cents || 0) / 100).toFixed(2)}`)
  }
  if (idsByType.property_deal?.length) {
    const ids = Array.from(new Set(idsByType.property_deal))
    const { data } = await supabase.from('property_deals').select('id, deal_type, contato_id').in('id', ids)
    const names = await contatoNamesFor(supabase, (data || []).map((d: any) => d.contato_id))
    for (const d of data || []) relatedLabel.set(`property_deal:${d.id}`, `${names.get(d.contato_id) || 'Negócio'} (${d.deal_type === 'locacao' ? 'Locação' : 'Venda'})`)
  }
  if (idsByType.property_proposal?.length) {
    const ids = Array.from(new Set(idsByType.property_proposal))
    const { data } = await supabase.from('property_proposals').select('id, operation_type, contato_id').in('id', ids)
    const names = await contatoNamesFor(supabase, (data || []).map((p: any) => p.contato_id))
    for (const p of data || []) relatedLabel.set(`property_proposal:${p.id}`, `${names.get(p.contato_id) || 'Proposta'} (${p.operation_type === 'locacao' ? 'Locação' : 'Venda'})`)
  }

  return { saleLabel, relatedLabel }
}

/** Monta o objeto `related: {type, label}` que EditSheet/TasksBoardShared
 *  esperam pra inicializar o seletor "Relacionado a" sem zerar o vínculo
 *  existente ao salvar (contato > reserva > related_entity_*, mesma
 *  precedência de relationshipUpdates em tasks-crud.ts). */
export function buildTaskRelated(
  row: TaskRelatedRow,
  labels: { saleLabel: Map<string, string>; relatedLabel: Map<string, string> },
): RelatedRef {
  const leads = Array.isArray(row.leads) ? (row.leads[0] ?? null) : (row.leads ?? null)
  if (leads) return { type: 'contato', label: leads.name }
  if (row.sale_id) return { type: 'reserva', label: labels.saleLabel.get(row.sale_id) || 'Reserva' }
  if (row.related_entity_type && row.related_entity_id) {
    return {
      type: row.related_entity_type,
      label: labels.relatedLabel.get(`${row.related_entity_type}:${row.related_entity_id}`) || RELATED_LABELS[row.related_entity_type] || 'Relacionado',
    }
  }
  return null
}
