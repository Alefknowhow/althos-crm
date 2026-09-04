'use server'

/**
 * Vertical Clínicas — notas fiscais de insumos (CRUD, importação de XML) e
 * KPIs do estoque. Split out of actions/clinic-estoque.ts.
 */

import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'
import { parseNfeXml } from '@/lib/clinic/nfe-xml'
import { requireEstoqueAccess, listClinicSupplies } from './clinic-estoque-supplies'

export type ClinicSupplyInvoiceRow = {
  id: string
  nf_number: string | null
  supplier_name: string | null
  issued_at: string | null
  total_cents: number | null
  import_method: string
  storage_path: string | null
  created_at: string
  item_count: number
  financial_entry_id: string | null
}

export async function listClinicSupplyInvoices(orgSlug: string, search?: string): Promise<ClinicSupplyInvoiceRow[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('clinic_supply_invoices')
    .select('id, nf_number, supplier_name, issued_at, total_cents, import_method, storage_path, created_at, financial_entry_id, clinic_supply_invoice_items(count)')
    .eq('organization_id', org.id)
    .order('issued_at', { ascending: false })
    .limit(200)

  let rows = (data || []).map((r: any) => ({
    id: r.id,
    nf_number: r.nf_number,
    supplier_name: r.supplier_name,
    issued_at: r.issued_at,
    total_cents: r.total_cents,
    import_method: r.import_method,
    storage_path: r.storage_path,
    created_at: r.created_at,
    item_count: r.clinic_supply_invoice_items?.[0]?.count ?? 0,
    financial_entry_id: r.financial_entry_id,
  }))

  if (search?.trim()) {
    const term = search.trim().toLowerCase()
    rows = rows.filter(r => (r.nf_number || '').toLowerCase().includes(term) || (r.supplier_name || '').toLowerCase().includes(term))
  }
  return rows
}

export type ClinicSupplyInvoiceItemInput = {
  supply_id: string | null
  description_raw: string
  quantity: number
  unit_cost_cents: number | null
  total_cost_cents: number | null
  create_new_supply?: { name: string; unit: string } | null
}

/**
 * Confirma uma NF (lançada manualmente ou revisada após importação de XML):
 * cria a invoice + itens, e para cada item com supply_id (ou pedido de criar
 * insumo novo), dá entrada no estoque — soma quantity, atualiza
 * last_unit_cost_cents/last_purchase_at/last_purchase_nf_number. Itens sem
 * supply_id e sem create_new_supply ficam só registrados na NF, sem afetar
 * estoque (mapeamento pendente).
 *
 * Também gera automaticamente um lançamento de despesa em Financeiro
 * (categoria "Insumos (NF)") pelo valor total da NF, linkado via
 * financial_entry_id — mesmo padrão de clinic_attendances.financial_entry_id
 * pro lado da receita.
 */
export async function createClinicSupplyInvoice(orgSlug: string, input: {
  nf_number: string | null
  supplier_name: string | null
  issued_at: string | null
  total_cents: number | null
  import_method: 'xml' | 'ocr' | 'manual'
  storage_path?: string | null
  items: ClinicSupplyInvoiceItemInput[]
}) {
  const { org, user } = await requireEstoqueAccess(orgSlug)
  const supabase = createClient()

  let financialEntryId: string | null = null
  if (input.total_cents && input.total_cents > 0) {
    const { data: entry } = await supabase
      .from('financial_entries')
      .insert({
        organization_id: org.id,
        tipo: 'despesa',
        categoria: 'Insumos (NF)',
        valor_cents: input.total_cents,
        competencia: (input.issued_at || new Date().toISOString()).slice(0, 10),
        status: 'pendente',
        nota_fiscal: input.nf_number || null,
        observacoes: input.supplier_name ? `Fornecedor: ${input.supplier_name}` : null,
      })
      .select('id')
      .maybeSingle()
    financialEntryId = entry?.id ?? null
  }

  const { data: invoice, error: invErr } = await supabase
    .from('clinic_supply_invoices')
    .insert({
      organization_id: org.id,
      nf_number: input.nf_number,
      supplier_name: input.supplier_name,
      issued_at: input.issued_at,
      total_cents: input.total_cents,
      import_method: input.import_method,
      storage_path: input.storage_path || null,
      financial_entry_id: financialEntryId,
      created_by: user.id,
    })
    .select('id')
    .maybeSingle()
  if (invErr || !invoice) return { ok: false as const, error: invErr?.message || 'Falha ao criar NF.' }

  for (const item of input.items) {
    let supplyId = item.supply_id

    if (!supplyId && item.create_new_supply?.name) {
      const { data: created } = await supabase
        .from('clinic_supplies')
        .insert({
          organization_id: org.id,
          name: item.create_new_supply.name,
          unit: item.create_new_supply.unit || 'un',
          quantity_in_stock: 0,
          first_acquired_at: input.issued_at || new Date().toISOString(),
          created_by: user.id,
        })
        .select('id')
        .maybeSingle()
      supplyId = created?.id || null
    }

    await supabase.from('clinic_supply_invoice_items').insert({
      organization_id: org.id,
      invoice_id: invoice.id,
      supply_id: supplyId,
      description_raw: item.description_raw,
      quantity: item.quantity,
      unit_cost_cents: item.unit_cost_cents,
      total_cost_cents: item.total_cost_cents,
    })

    if (supplyId) {
      const { data: supply } = await supabase.from('clinic_supplies').select('quantity_in_stock').eq('id', supplyId).eq('organization_id', org.id).maybeSingle()
      if (supply) {
        const newQty = Number(supply.quantity_in_stock) + Number(item.quantity)
        await supabase.from('clinic_supplies').update({
          quantity_in_stock: newQty,
          last_unit_cost_cents: item.unit_cost_cents ?? undefined,
          last_purchase_at: input.issued_at || new Date().toISOString(),
          last_purchase_nf_number: input.nf_number || undefined,
          updated_at: new Date().toISOString(),
        }).eq('id', supplyId).eq('organization_id', org.id)
      }
    }
  }

  revalidatePath(`/app/${orgSlug}/estoque`)
  revalidatePath(`/app/${orgSlug}/financeiro`)
  return { ok: true as const, invoiceId: invoice.id as string }
}

export type NfeReviewItem = {
  description_raw: string
  quantity: number
  unit_cost_cents: number | null
  total_cost_cents: number | null
  matched_supply_id: string | null
  matched_supply_name: string | null
}

export type NfeReviewResult = {
  nf_number: string | null
  supplier_name: string | null
  issued_at: string | null
  total_cents: number | null
  items: NfeReviewItem[]
}

function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

/**
 * Faz o parse do XML e tenta casar cada item com um insumo já cadastrado
 * (match exato por nome normalizado, depois por substring) para a tela de
 * revisão pré-preencher a associação — o usuário confirma/corrige antes de
 * createClinicSupplyInvoice ser chamada.
 */
export async function parseClinicSupplyInvoiceXml(orgSlug: string, xmlContent: string): Promise<{ ok: true; data: NfeReviewResult } | { ok: false; error: string }> {
  await requireEstoqueAccess(orgSlug)
  let parsed
  try {
    parsed = parseNfeXml(xmlContent)
  } catch {
    return { ok: false, error: 'Não foi possível interpretar o XML. Confirme que é uma NF-e válida.' }
  }
  if (!parsed.items.length) return { ok: false, error: 'Nenhum item encontrado no XML.' }

  const supplies = await listClinicSupplies(orgSlug)
  const items: NfeReviewItem[] = parsed.items.map(item => {
    const normDesc = normalize(item.description_raw)
    let match = supplies.find(s => normalize(s.name) === normDesc)
    if (!match) match = supplies.find(s => normDesc.includes(normalize(s.name)) || normalize(s.name).includes(normDesc))
    return {
      ...item,
      matched_supply_id: match?.id || null,
      matched_supply_name: match?.name || null,
    }
  })

  return { ok: true, data: { ...parsed, items } }
}

export type ClinicEstoqueKpis = {
  totalStockValueCents: number
  itemCount: number
  lowStockCount: number
  consumptionValueThisMonthCents: number
}

export async function getClinicEstoqueKpis(orgSlug: string): Promise<ClinicEstoqueKpis> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data: supplies } = await supabase
    .from('clinic_supplies')
    .select('quantity_in_stock, min_stock_alert, last_unit_cost_cents')
    .eq('organization_id', org.id)
    .eq('active', true)

  let totalStockValueCents = 0
  let lowStockCount = 0
  for (const s of supplies || []) {
    totalStockValueCents += Math.round(Number(s.quantity_in_stock) * (s.last_unit_cost_cents || 0))
    if (s.min_stock_alert != null && Number(s.quantity_in_stock) <= Number(s.min_stock_alert)) lowStockCount++
  }

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const { data: consumption } = await supabase
    .from('clinic_supply_consumption_log')
    .select('quantity, supply_id, clinic_supplies(last_unit_cost_cents)')
    .eq('organization_id', org.id)
    .eq('source', 'atendimento')
    .gte('consumed_at', monthStart.toISOString())

  let consumptionValueThisMonthCents = 0
  for (const c of (consumption || []) as any[]) {
    consumptionValueThisMonthCents += Math.round(Number(c.quantity) * (c.clinic_supplies?.last_unit_cost_cents || 0))
  }

  return {
    totalStockValueCents,
    itemCount: (supplies || []).length,
    lowStockCount,
    consumptionValueThisMonthCents,
  }
}
