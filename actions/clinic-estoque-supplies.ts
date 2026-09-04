'use server'

/**
 * Vertical Clínicas — catálogo de insumos (CRUD + ajuste manual de estoque).
 * Split out of actions/clinic-estoque.ts.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'

export async function requireEstoqueAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'estoque_clinica')
  if (!check.allowed) throw new Error(check.reason || 'Sem permissão')
  return { org, user }
}

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
  avg_daily_consumption: number | null
  duration_days: number | null
}

// Janela usada pra calcular o consumo médio diário — consumo por atendimento
// dos últimos N dias / N. Curta o suficiente pra refletir o ritmo atual da
// clínica, longa o suficiente pra não virar ruído com poucos atendimentos.
const CONSUMPTION_AVG_WINDOW_DAYS = 30

export async function listClinicSupplies(orgSlug: string): Promise<ClinicSupplyRow[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('clinic_supplies')
    .select('id, name, unit, supplier_name, quantity_in_stock, min_stock_alert, last_unit_cost_cents, first_acquired_at, last_purchase_at, last_purchase_nf_number, active')
    .eq('organization_id', org.id)
    .order('name')

  const supplies = data || []
  if (supplies.length === 0) return []

  const windowStart = new Date()
  windowStart.setDate(windowStart.getDate() - CONSUMPTION_AVG_WINDOW_DAYS)
  const { data: consumption } = await supabase
    .from('clinic_supply_consumption_log')
    .select('supply_id, quantity')
    .eq('organization_id', org.id)
    .eq('source', 'atendimento')
    .gte('consumed_at', windowStart.toISOString())

  const totalBySupply = new Map<string, number>()
  for (const c of consumption || []) {
    totalBySupply.set(c.supply_id, (totalBySupply.get(c.supply_id) || 0) + Number(c.quantity))
  }

  return supplies.map((r: any) => {
    const quantityInStock = Number(r.quantity_in_stock)
    const totalConsumed = totalBySupply.get(r.id) || 0
    const avgDailyConsumption = totalConsumed > 0 ? totalConsumed / CONSUMPTION_AVG_WINDOW_DAYS : null
    const durationDays = avgDailyConsumption && avgDailyConsumption > 0 ? Math.floor(quantityInStock / avgDailyConsumption) : null
    return {
      ...r,
      quantity_in_stock: quantityInStock,
      min_stock_alert: r.min_stock_alert != null ? Number(r.min_stock_alert) : null,
      stock_value_cents: Math.round(quantityInStock * (r.last_unit_cost_cents || 0)),
      avg_daily_consumption: avgDailyConsumption,
      duration_days: durationDays,
    }
  })
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
