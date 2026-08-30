'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'

/**
 * Vertical Clínicas — Fase 5: Atendimentos. Registro operacional (NÃO
 * prontuário médico) do que aconteceu num atendimento — paciente =
 * contatos (Core), profissional = clinic_professionals, serviço =
 * event_types. Ver supabase/migrations/0167_clinic_attendances.sql.
 * A maioria é criada automaticamente por setClinicAppointmentStatus
 * (actions/clinic.ts) quando um agendamento vira "realizado"; esse
 * arquivo cobre listagem, edição (observações/recomendações/retorno) e
 * criação manual (atendimento avulso, sem agendamento prévio).
 */

async function requireAtendimentosAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'atendimentos_clinica')
  if (!check.allowed) throw new Error(check.reason || 'Sem permissão')
  return { org, user }
}

export type ClinicAttendanceRow = {
  id: string
  appointment_id: string | null
  patient_contato_id: string
  patient_name: string
  professional_id: string | null
  professional_name: string | null
  event_type_id: string | null
  service_name: string | null
  attended_at: string
  notes: string | null
  recommendations: string | null
  next_return_date: string | null
  total_cents: number | null
  discount_cents: number
  payment_method: string | null
  financial_entry_id: string | null
}

export async function listClinicAttendances(orgSlug: string): Promise<ClinicAttendanceRow[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('clinic_attendances')
    .select('id, appointment_id, patient_contato_id, professional_id, event_type_id, attended_at, notes, recommendations, next_return_date, total_cents, discount_cents, payment_method, financial_entry_id, contatos(name), clinic_professionals(name), event_types(name)')
    .eq('organization_id', org.id)
    .order('attended_at', { ascending: false })
    .limit(200)

  return (data || []).map((r: any) => ({
    id: r.id,
    appointment_id: r.appointment_id,
    patient_contato_id: r.patient_contato_id,
    patient_name: r.contatos?.name || 'Contato removido',
    professional_id: r.professional_id,
    professional_name: r.clinic_professionals?.name || null,
    event_type_id: r.event_type_id,
    service_name: r.event_types?.name || null,
    attended_at: r.attended_at,
    notes: r.notes,
    recommendations: r.recommendations,
    next_return_date: r.next_return_date,
    total_cents: r.total_cents,
    discount_cents: r.discount_cents || 0,
    payment_method: r.payment_method,
    financial_entry_id: r.financial_entry_id,
  }))
}

export type ClinicAttendanceInput = {
  patient_contato_id: string
  professional_id: string | null
  event_type_id: string | null
  attended_at: string
  notes: string | null
  recommendations: string | null
  next_return_date: string | null
  total_cents?: number | null
  discount_cents?: number
  payment_method?: string | null
}

export async function createClinicAttendance(orgSlug: string, input: ClinicAttendanceInput) {
  const { org, user } = await requireAtendimentosAccess(orgSlug)
  if (!input.patient_contato_id) return { ok: false as const, error: 'Selecione o paciente.' }
  const supabase = createClient()
  const { error } = await supabase.from('clinic_attendances').insert({
    organization_id: org.id,
    patient_contato_id: input.patient_contato_id,
    professional_id: input.professional_id || null,
    event_type_id: input.event_type_id || null,
    attended_at: input.attended_at || new Date().toISOString(),
    notes: input.notes || null,
    recommendations: input.recommendations || null,
    next_return_date: input.next_return_date || null,
    total_cents: input.total_cents ?? null,
    discount_cents: input.discount_cents ?? 0,
    payment_method: input.payment_method || null,
    created_by: user.id,
  })
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/atendimentos`)
  return { ok: true as const }
}

/**
 * Edita um atendimento. Quando total_cents/discount_cents mudam e o
 * atendimento já tem um lançamento em Financeiro (financial_entry_id —
 * criado automaticamente na conclusão do agendamento), o valor do
 * lançamento é atualizado junto — a receita sempre reflete o que a tela de
 * Atendimentos mostra, sem precisar editar os dois lugares.
 */
export async function updateClinicAttendance(orgSlug: string, id: string, input: Partial<ClinicAttendanceInput>) {
  const { org } = await requireAtendimentosAccess(orgSlug)
  const supabase = createClient()
  const patch: Record<string, unknown> = {}
  if (input.professional_id !== undefined) patch.professional_id = input.professional_id || null
  if (input.event_type_id !== undefined) patch.event_type_id = input.event_type_id || null
  if (input.attended_at !== undefined) patch.attended_at = input.attended_at
  if (input.notes !== undefined) patch.notes = input.notes || null
  if (input.recommendations !== undefined) patch.recommendations = input.recommendations || null
  if (input.next_return_date !== undefined) patch.next_return_date = input.next_return_date || null
  if (input.total_cents !== undefined) patch.total_cents = input.total_cents
  if (input.discount_cents !== undefined) patch.discount_cents = input.discount_cents
  if (input.payment_method !== undefined) patch.payment_method = input.payment_method || null

  const { data: updated, error } = await supabase
    .from('clinic_attendances')
    .update(patch)
    .eq('id', id)
    .eq('organization_id', org.id)
    .select('financial_entry_id, total_cents, discount_cents')
    .maybeSingle()
  if (error) return { ok: false as const, error: error.message }

  if (updated?.financial_entry_id && (input.total_cents !== undefined || input.discount_cents !== undefined)) {
    const netCents = Math.max(0, (updated.total_cents || 0) - (updated.discount_cents || 0))
    await supabase
      .from('financial_entries')
      .update({ valor_cents: netCents })
      .eq('id', updated.financial_entry_id)
      .eq('organization_id', org.id)
  }

  revalidatePath(`/app/${orgSlug}/atendimentos`)
  return { ok: true as const }
}

export async function deleteClinicAttendance(orgSlug: string, id: string) {
  const { org } = await requireAtendimentosAccess(orgSlug)
  const supabase = createClient()
  const { error } = await supabase.from('clinic_attendances').delete().eq('id', id).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/atendimentos`)
  return { ok: true as const }
}
