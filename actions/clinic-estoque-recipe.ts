'use server'

/**
 * Vertical Clínicas — receita por procedimento (event_types ↔ insumos),
 * baixa automática por atendimento, e o backlog de consumo.
 * Split out of actions/clinic-estoque.ts.
 */

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'
import { requireEstoqueAccess } from './clinic-estoque-supplies'

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
