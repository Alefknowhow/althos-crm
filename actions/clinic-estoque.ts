'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'
import { parseNfeXml } from '@/lib/clinic/nfe-xml'

/**
 * Vertical Clínicas — Estoque de insumos (exclusivo do nicho). Ver
 * supabase/migrations/0211_clinic_estoque_foundation.sql.
 *
 * Baixa automática: quando um agendamento vira "realizado"
 * (setClinicAppointmentStatus, actions/clinic.ts), consumeSupplyForAttendance
 * é chamada com o event_type_id do procedimento — para cada linha em
 * clinic_supply_recipe daquele procedimento, decrementa
 * clinic_supplies.quantity_in_stock e grava uma linha no backlog
 * (clinic_supply_consumption_log). É o único caminho de baixa por
 * atendimento — consumo manual/ajuste usa o mesmo log com source diferente.
 */

async function requireEstoqueAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'estoque_clinica')
  if (!check.allowed) throw new Error(check.reason || 'Sem permissão')
  return { org, user }
}

// ── Catálogo de insumos ──────────────────────────────────────────────────────

export type ClinicSupplyRow = {
  id: string
  name: string
  unit: string
  supplier_name: string | null
  quantity_in_stock: number
  min_stock_alert: number | null
  last_unit_cost_cents: number | null
  first_acquired_at: string | null
  last_purchase_at: string | null
  last_purchase_nf_number: string | null
  active: boolean
  stock_value_cents: number
}

export async function listClinicSupplies(orgSlug: string): Promise<ClinicSupplyRow[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('clinic_supplies')
    .select('id, name, unit, supplier_name, quantity_in_stock, min_stock_alert, last_unit_cost_cents, first_acquired_at, last_purchase_at, last_purchase_nf_number, active')
    .eq('organization_id', org.id)
    .order('name')

  return (data || []).map((r: any) => ({
    ...r,
    quantity_in_stock: Number(r.quantity_in_stock),
    min_stock_alert: r.min_stock_alert != null ? Number(r.min_stock_alert) : null,
    stock_value_cents: Math.round(Number(r.quantity_in_stock) * (r.last_unit_cost_cents || 0)),
  }))
}

export type ClinicSupplyInput = {
  name: string
  unit: string
  supplier_name?: string | null
  quantity_in_stock?: number
  min_stock_alert?: number | null
  last_unit_cost_cents?: number | null
  first_acquired_at?: string | null
  last_purchase_at?: string | null
  last_purchase_nf_number?: string | null
  active?: boolean
}

export async function createClinicSupply(orgSlug: string, input: ClinicSupplyInput) {
  const { org, user } = await requireEstoqueAccess(orgSlug)
  if (!input.name?.trim()) return { ok: false as const, error: 'Informe o nome do insumo.' }
  const supabase = createClient()
  const { error } = await supabase.from('clinic_supplies').insert({
    organization_id: org.id,
    name: input.name.trim(),
    unit: input.unit?.trim() || 'un',
    supplier_name: input.supplier_name || null,
    quantity_in_stock: input.quantity_in_stock ?? 0,
    min_stock_alert: input.min_stock_alert ?? null,
    last_unit_cost_cents: input.last_unit_cost_cents ?? null,
    first_acquired_at: input.first_acquired_at || new Date().toISOString(),
    last_purchase_at: input.last_purchase_at || null,
    last_purchase_nf_number: input.last_purchase_nf_number || null,
    created_by: user.id,
  })
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/estoque`)
  return { ok: true as const }
}

export async function updateClinicSupply(orgSlug: string, id: string, input: Partial<ClinicSupplyInput>) {
  const { org } = await requireEstoqueAccess(orgSlug)
  const supabase = createClient()
  const patch: Record<string, unknown> = {}
  if (input.name !== undefined) patch.name = input.name.trim()
  if (input.unit !== undefined) patch.unit = input.unit?.trim() || 'un'
  if (input.supplier_name !== undefined) patch.supplier_name = input.supplier_name || null
  if (input.quantity_in_stock !== undefined) patch.quantity_in_stock = input.quantity_in_stock
  if (input.min_stock_alert !== undefined) patch.min_stock_alert = input.min_stock_alert
  if (input.last_unit_cost_cents !== undefined) patch.last_unit_cost_cents = input.last_unit_cost_cents
  if (input.first_acquired_at !== undefined) patch.first_acquired_at = input.first_acquired_at || null
  if (input.last_purchase_at !== undefined) patch.last_purchase_at = input.last_purchase_at || null
  if (input.last_purchase_nf_number !== undefined) patch.last_purchase_nf_number = input.last_purchase_nf_number || null
  if (input.active !== undefined) patch.active = input.active
  patch.updated_at = new Date().toISOString()

  const { error } = await supabase.from('clinic_supplies').update(patch).eq('id', id).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/estoque`)
  return { ok: true as const }
}

export async function deleteClinicSupply(orgSlug: string, id: string) {
  const { org } = await requireEstoqueAccess(orgSlug)
  const supabase = createClient()
  const { error } = await supabase.from('clinic_supplies').delete().eq('id', id).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/estoque`)
  return { ok: true as const }
}

/** Ajuste manual de estoque — grava no mesmo backlog de consumo (source='ajuste'/'manual'). */
export async function adjustClinicSupplyStock(orgSlug: string, id: string, quantityDelta: number, notes?: string) {
  const { org, user } = await requireEstoqueAccess(orgSlug)
  if (!quantityDelta) return { ok: false as const, error: 'Informe uma quantidade diferente de zero.' }
  const supabase = createClient()
  const { data: supply } = await supabase
    .from('clinic_supplies')
    .select('quantity_in_stock')
    .eq('id', id)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!supply) return { ok: false as const, error: 'Insumo não encontrado.' }

  const newQty = Number(supply.quantity_in_stock) + quantityDelta
  const { error } = await supabase.from('clinic_supplies').update({ quantity_in_stock: newQty, updated_at: new Date().toISOString() }).eq('id', id).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }

  await supabase.from('clinic_supply_consumption_log').insert({
    organization_id: org.id,
    supply_id: id,
    quantity: -quantityDelta, // consumo positivo = saída; ajuste de entrada fica negativo no log
    source: 'ajuste',
    notes: notes || null,
    created_by: user.id,
  })

  revalidatePath(`/app/${orgSlug}/estoque`)
  return { ok: true as const }
}

// ── Receita por procedimento (event_types ↔ insumos) ─────────────────────────

export type ClinicSupplyRecipeRow = {
  id: string
  event_type_id: string
  supply_id: string
  supply_name: string
  unit: string
  quantity_per_use: number
}

export async function listClinicSupplyRecipe(orgSlug: string, eventTypeId: string): Promise<ClinicSupplyRecipeRow[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('clinic_supply_recipe')
    .select('id, event_type_id, supply_id, quantity_per_use, clinic_supplies(name, unit)')
    .eq('organization_id', org.id)
    .eq('event_type_id', eventTypeId)

  return (data || []).map((r: any) => ({
    id: r.id,
    event_type_id: r.event_type_id,
    supply_id: r.supply_id,
    supply_name: r.clinic_supplies?.name || 'Insumo removido',
    unit: r.clinic_supplies?.unit || 'un',
    quantity_per_use: Number(r.quantity_per_use),
  }))
}

export async function upsertClinicSupplyRecipe(orgSlug: string, eventTypeId: string, supplyId: string, quantityPerUse: number) {
  const { org } = await requireEstoqueAccess(orgSlug)
  if (quantityPerUse <= 0) return { ok: false as const, error: 'A quantidade precisa ser maior que zero.' }
  const supabase = createClient()
  const { error } = await supabase
    .from('clinic_supply_recipe')
    .upsert({ organization_id: org.id, event_type_id: eventTypeId, supply_id: supplyId, quantity_per_use: quantityPerUse }, { onConflict: 'event_type_id,supply_id' })
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/agendamentos`)
  revalidatePath(`/app/${orgSlug}/estoque`)
  return { ok: true as const }
}

export async function deleteClinicSupplyRecipe(orgSlug: string, id: string) {
  const { org } = await requireEstoqueAccess(orgSlug)
  const supabase = createClient()
  const { error } = await supabase.from('clinic_supply_recipe').delete().eq('id', id).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/agendamentos`)
  revalidatePath(`/app/${orgSlug}/estoque`)
  return { ok: true as const }
}

// ── Baixa automática por atendimento ─────────────────────────────────────────

/**
 * Chamada por setClinicAppointmentStatus (actions/clinic.ts) quando um
 * agendamento vira "realizado". Usa admin client porque roda dentro do
 * fluxo de conclusão de agendamento (mesmo padrão de financial_entries/
 * clinic_commissions nesse arquivo) — organizationId já vem resolvido pelo
 * caller, então filtragem manual por org é aplicada em toda query.
 */
export async function consumeSupplyForAttendance(params: {
  organizationId: string
  eventTypeId: string | null
  attendanceId: string
  professionalId: string | null
  patientContatoId: string | null
}) {
  if (!params.eventTypeId) return
  const supabase = createAdminClient()
  const { data: recipe } = await supabase
    .from('clinic_supply_recipe')
    .select('supply_id, quantity_per_use')
    .eq('organization_id', params.organizationId)
    .eq('event_type_id', params.eventTypeId)
  if (!recipe || recipe.length === 0) return

  for (const item of recipe) {
    const { data: supply } = await supabase
      .from('clinic_supplies')
      .select('quantity_in_stock')
      .eq('id', item.supply_id)
      .eq('organization_id', params.organizationId)
      .maybeSingle()
    if (!supply) continue
    const newQty = Number(supply.quantity_in_stock) - Number(item.quantity_per_use)
    await supabase.from('clinic_supplies').update({ quantity_in_stock: newQty, updated_at: new Date().toISOString() }).eq('id', item.supply_id).eq('organization_id', params.organizationId)
    await supabase.from('clinic_supply_consumption_log').insert({
      organization_id: params.organizationId,
      supply_id: item.supply_id,
      quantity: Number(item.quantity_per_use),
      source: 'atendimento',
      attendance_id: params.attendanceId,
      professional_id: params.professionalId,
      patient_contato_id: params.patientContatoId,
    })
  }
}

// ── Backlog de consumo ────────────────────────────────────────────────────────

export type ClinicSupplyConsumptionRow = {
  id: string
  supply_id: string
  supply_name: string
  unit: string
  quantity: number
  source: string
  attendance_id: string | null
  professional_id: string | null
  professional_name: string | null
  patient_name: string | null
  notes: string | null
  consumed_at: string
}

export async function listClinicSupplyConsumption(orgSlug: string, filters?: {
  from?: string
  to?: string
  professionalId?: string
  supplyId?: string
  search?: string
}): Promise<ClinicSupplyConsumptionRow[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  let query = supabase
    .from('clinic_supply_consumption_log')
    .select('id, supply_id, quantity, source, attendance_id, professional_id, notes, consumed_at, clinic_supplies(name, unit), clinic_professionals(name), contatos(name)')
    .eq('organization_id', org.id)
    .order('consumed_at', { ascending: false })
    .limit(500)

  if (filters?.from) query = query.gte('consumed_at', filters.from)
  if (filters?.to) query = query.lte('consumed_at', filters.to)
  if (filters?.professionalId) query = query.eq('professional_id', filters.professionalId)
  if (filters?.supplyId) query = query.eq('supply_id', filters.supplyId)

  const { data } = await query
  let rows = (data || []).map((r: any) => ({
    id: r.id,
    supply_id: r.supply_id,
    supply_name: r.clinic_supplies?.name || 'Insumo removido',
    unit: r.clinic_supplies?.unit || 'un',
    quantity: Number(r.quantity),
    source: r.source,
    attendance_id: r.attendance_id,
    professional_id: r.professional_id,
    professional_name: r.clinic_professionals?.name || null,
    patient_name: r.contatos?.name || null,
    notes: r.notes,
    consumed_at: r.consumed_at,
  }))

  if (filters?.search?.trim()) {
    const term = filters.search.trim().toLowerCase()
    rows = rows.filter(r =>
      r.supply_name.toLowerCase().includes(term) ||
      (r.professional_name || '').toLowerCase().includes(term) ||
      (r.patient_name || '').toLowerCase().includes(term)
    )
  }

  return rows
}

// ── Notas fiscais ─────────────────────────────────────────────────────────────

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
}

export async function listClinicSupplyInvoices(orgSlug: string, search?: string): Promise<ClinicSupplyInvoiceRow[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('clinic_supply_invoices')
    .select('id, nf_number, supplier_name, issued_at, total_cents, import_method, storage_path, created_at, clinic_supply_invoice_items(count)')
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
  return { ok: true as const, invoiceId: invoice.id as string }
}

// ── Importação de NF via XML ─────────────────────────────────────────────────

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

// ── KPIs ───────────────────────────────────────────────────────────────────────

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
