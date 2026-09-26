'use server'

/**
 * Picker de origem de contrato (Reserva/Venda/Oportunidade) — extraído de
 * actions/contracts-global.ts (que passou do limite de 350 linhas de
 * arquivo). Issue #60, B.2.
 */

import { createClient } from '@/lib/supabase/server'
import { requireContractsAccess, type RelatedEntityType } from './contracts-global'

export type SaleContractOption = {
  id: string
  label: string
  contatoId: string | null
  contatoName: string | null
  amountCents: number | null
}

/** Busca origens pra vincular a um contrato novo — generalizado (issue #60,
 *  B.2): todo contrato do módulo global precisa nascer ligado a uma origem
 *  (e, por tabela, ao cliente dela) além da própria organização como parte
 *  contratada. Nicho viagens usa Reserva como "a venda do nicho"; demais
 *  usam Venda genérica. Oportunidade é sempre uma opção secundária. */
export async function listContractOriginOptions(
  orgSlug: string,
  type: RelatedEntityType,
  query = '',
): Promise<SaleContractOption[]> {
  const { org, perm } = await requireContractsAccess(orgSlug)
  if (!perm.allowed) return []
  const supabase = createClient()

  if (type === 'venda') {
    let q = supabase
      .from('sales')
      .select('id, amount_cents, sale_date, contatos!inner(id, name), products(name)')
      .eq('organization_id', org.id)
      .order('sale_date', { ascending: false })
      .limit(30)
    if (query.trim()) q = q.ilike('contatos.name', `%${query.trim()}%`)
    const { data } = await q
    return ((data || []) as any[])
      .filter(row => row.contatos)
      .map(row => ({
        id: row.id,
        label: `${row.contatos.name}${row.products?.name ? ` — ${row.products.name}` : ''}`,
        contatoId: row.contatos.id,
        contatoName: row.contatos.name,
        amountCents: row.amount_cents,
      }))
  }

  if (type === 'reserva') {
    let q = supabase
      .from('travel_sales')
      .select('id, total_cents, created_at, contato_id, client_name, destination')
      .eq('organization_id', org.id)
      .order('created_at', { ascending: false })
      .limit(30)
    if (query.trim()) q = q.ilike('client_name', `%${query.trim()}%`)
    const { data } = await q
    return ((data || []) as any[]).map(row => ({
      id: row.id,
      label: `${row.client_name || 'Cliente'}${row.destination ? ` — ${row.destination}` : ''}`,
      contatoId: row.contato_id,
      contatoName: row.client_name,
      amountCents: row.total_cents,
    }))
  }

  // oportunidade — contatos ainda não clientes (leads em pipeline).
  let q = supabase
    .from('contatos')
    .select('id, name, value_cents, status')
    .eq('organization_id', org.id)
    .neq('status', 'cliente')
    .order('created_at', { ascending: false })
    .limit(30)
  if (query.trim()) q = q.ilike('name', `%${query.trim()}%`)
  const { data } = await q
  return ((data || []) as any[]).map(row => ({
    id: row.id,
    label: row.name || 'Contato',
    contatoId: row.id,
    contatoName: row.name,
    amountCents: row.value_cents,
  }))
}

/** Mantido como wrapper — comportamento idêntico ao antigo picker fixo em
 *  Venda, ainda usado por callers que não migraram pra origem selecionável. */
export async function listSalesForContractPicker(orgSlug: string, query = ''): Promise<SaleContractOption[]> {
  return listContractOriginOptions(orgSlug, 'venda', query)
}

/** Resolve UMA origem por id exato — usado pelo atalho `?origin=&id=` (B.3):
 *  abrir o diálogo já com a origem pré-selecionada, sem depender de busca
 *  textual (o id vem da URL, não de uma digitação do usuário). */
export async function getContractOriginOption(orgSlug: string, type: RelatedEntityType, id: string): Promise<SaleContractOption | null> {
  const { org, perm } = await requireContractsAccess(orgSlug)
  if (!perm.allowed) return null
  const supabase = createClient()

  if (type === 'venda') {
    const { data: row } = await supabase
      .from('sales').select('id, amount_cents, contatos!inner(id, name), products(name)')
      .eq('id', id).eq('organization_id', org.id).maybeSingle()
    if (!row || !(row as any).contatos) return null
    const r = row as any
    return { id: r.id, label: `${r.contatos.name}${r.products?.name ? ` — ${r.products.name}` : ''}`, contatoId: r.contatos.id, contatoName: r.contatos.name, amountCents: r.amount_cents }
  }
  if (type === 'reserva') {
    const { data: row } = await supabase
      .from('travel_sales').select('id, total_cents, contato_id, client_name, destination')
      .eq('id', id).eq('organization_id', org.id).maybeSingle()
    if (!row) return null
    const r = row as any
    return { id: r.id, label: `${r.client_name || 'Cliente'}${r.destination ? ` — ${r.destination}` : ''}`, contatoId: r.contato_id, contatoName: r.client_name, amountCents: r.total_cents }
  }
  const { data: row } = await supabase.from('contatos').select('id, name, value_cents').eq('id', id).eq('organization_id', org.id).maybeSingle()
  if (!row) return null
  const r = row as any
  return { id: r.id, label: r.name || 'Contato', contatoId: r.id, contatoName: r.name, amountCents: r.value_cents }
}

/** Reservas têm seu próprio checklist (contrato_gerado_at/contrato_assinado_at,
 *  travel_sales) — quando um contrato global com origem 'reserva' é criado
 *  ou assinado, sincroniza esses timestamps pra o checklist continuar
 *  funcionando (issue #60, B.3). Best-effort: nunca lança, chamado de
 *  createContract/sendContractForSignature/webhook/refreshContractStatus. */
export async function syncReservaContractTimestamps(
  supabase: ReturnType<typeof createClient>,
  contractId: string,
  event: 'generated' | 'signed',
): Promise<void> {
  try {
    const { data: contract } = await supabase
      .from('contracts').select('related_entity_type, related_entity_id')
      .eq('id', contractId).maybeSingle()
    if (!contract || contract.related_entity_type !== 'reserva' || !contract.related_entity_id) return
    const column = event === 'generated' ? 'contrato_gerado_at' : 'contrato_assinado_at'
    await supabase.from('travel_sales').update({ [column]: new Date().toISOString() }).eq('id', contract.related_entity_id)
  } catch { /* best-effort */ }
}

export type ContractStatusInfo = { contractId: string; status: string } | null

/** Contrato mais recente não cancelado pra uma entidade (issue #60, B.3) —
 *  usado pelo `ContractStatusIndicator`. Ausente = null (mostra "Ausente"). */
export async function getContractStatusFor(orgSlug: string, type: RelatedEntityType, id: string): Promise<ContractStatusInfo> {
  const { org, perm } = await requireContractsAccess(orgSlug)
  if (!perm.allowed) return null
  const supabase = createClient()
  const { data } = await supabase
    .from('contracts')
    .select('id, status')
    .eq('organization_id', org.id)
    .eq('related_entity_type', type)
    .eq('related_entity_id', id)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ? { contractId: data.id, status: data.status } : null
}

/** Versão em lote — evita N+1 quando uma lista inteira precisa do
 *  indicador (ex.: SalesTable). */
export async function getContractStatusMap(orgSlug: string, type: RelatedEntityType, ids: string[]): Promise<Record<string, ContractStatusInfo>> {
  const { org, perm } = await requireContractsAccess(orgSlug)
  if (!perm.allowed || ids.length === 0) return {}
  const supabase = createClient()
  const { data } = await supabase
    .from('contracts')
    .select('id, status, related_entity_id, created_at')
    .eq('organization_id', org.id)
    .eq('related_entity_type', type)
    .in('related_entity_id', ids)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })

  const map: Record<string, ContractStatusInfo> = {}
  for (const row of data || []) {
    if (!map[row.related_entity_id]) map[row.related_entity_id] = { contractId: row.id, status: row.status }
  }
  return map
}

/** Contexto de origem de um contrato (usado na tela de detalhe pra exibir
 *  a venda/cliente vinculados) — só resolve quando related_entity_type
 *  é 'venda', igual ao que a Gestão sempre cria hoje. */
export async function getContractSaleContext(orgSlug: string, saleId: string) {
  const { org, perm } = await requireContractsAccess(orgSlug)
  if (!perm.allowed) return null
  const supabase = createClient()
  const { data } = await supabase
    .from('sales')
    .select('id, amount_cents, sale_date, contatos(id, name, email, phone), products(name)')
    .eq('id', saleId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!data || !(data as any).contatos) return null
  const row = data as any
  return {
    saleId: row.id,
    amountCents: row.amount_cents,
    saleDate: row.sale_date,
    productName: row.products?.name || null,
    contatoId: row.contatos.id,
    contatoName: row.contatos.name,
    contatoEmail: row.contatos.email,
    contatoPhone: row.contatos.phone,
  }
}
