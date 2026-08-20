'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'
import type { ClinicTreatmentStatus } from '@/lib/clinic-constants'

/**
 * Vertical Clínicas — Fase 6: Tratamentos (planos de N sessões).
 * Ver supabase/migrations/0168_clinic_treatments_packages.sql.
 */

async function requireTratamentosAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'tratamentos_clinica')
  if (!check.allowed) throw new Error(check.reason || 'Sem permissão')
  return { org, user }
}

export type ClinicTreatmentRow = {
  id: string
  patient_contato_id: string
  patient_name: string
  professional_id: string | null
  professional_name: string | null
  event_type_id: string | null
  service_name: string | null
  name: string
  total_sessions: number
  sessions_done: number
  status: ClinicTreatmentStatus
  notes: string | null
  created_at: string
}

export async function listClinicTreatments(orgSlug: string): Promise<ClinicTreatmentRow[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('clinic_treatments')
    .select('id, patient_contato_id, professional_id, event_type_id, name, total_sessions, sessions_done, status, notes, created_at, contatos(name), clinic_professionals(name), event_types(name)')
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })
    .limit(200)

  return (data || []).map((r: any) => ({
    id: r.id,
    patient_contato_id: r.patient_contato_id,
    patient_name: r.contatos?.name || 'Contato removido',
    professional_id: r.professional_id,
    professional_name: r.clinic_professionals?.name || null,
    event_type_id: r.event_type_id,
    service_name: r.event_types?.name || null,
    name: r.name,
    total_sessions: r.total_sessions,
    sessions_done: r.sessions_done,
    status: r.status,
    notes: r.notes,
    created_at: r.created_at,
  }))
}

export type ClinicTreatmentInput = {
  patient_contato_id: string
  professional_id: string | null
  event_type_id: string | null
  name: string
  total_sessions: number
  notes: string | null
}

export async function createClinicTreatment(orgSlug: string, input: ClinicTreatmentInput) {
  const { org, user } = await requireTratamentosAccess(orgSlug)
  if (!input.patient_contato_id) return { ok: false as const, error: 'Selecione o paciente.' }
  if (!input.name.trim()) return { ok: false as const, error: 'Nome do tratamento é obrigatório.' }
  if (!input.total_sessions || input.total_sessions < 1) return { ok: false as const, error: 'Informe o número de sessões.' }
  const supabase = createClient()
  const { error } = await supabase.from('clinic_treatments').insert({
    organization_id: org.id,
    patient_contato_id: input.patient_contato_id,
    professional_id: input.professional_id || null,
    event_type_id: input.event_type_id || null,
    name: input.name.trim(),
    total_sessions: input.total_sessions,
    notes: input.notes || null,
    created_by: user.id,
  })
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/tratamentos`)
  return { ok: true as const }
}

export async function updateClinicTreatment(orgSlug: string, id: string, input: Partial<ClinicTreatmentInput>) {
  const { org } = await requireTratamentosAccess(orgSlug)
  const supabase = createClient()
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.professional_id !== undefined) patch.professional_id = input.professional_id || null
  if (input.event_type_id !== undefined) patch.event_type_id = input.event_type_id || null
  if (input.name !== undefined) patch.name = input.name.trim()
  if (input.total_sessions !== undefined) patch.total_sessions = input.total_sessions
  if (input.notes !== undefined) patch.notes = input.notes || null
  const { error } = await supabase.from('clinic_treatments').update(patch).eq('id', id).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/tratamentos`)
  return { ok: true as const }
}

export async function deleteClinicTreatment(orgSlug: string, id: string) {
  const { org } = await requireTratamentosAccess(orgSlug)
  const supabase = createClient()
  const { error } = await supabase.from('clinic_treatments').delete().eq('id', id).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/tratamentos`)
  return { ok: true as const }
}

export async function setClinicTreatmentStatus(orgSlug: string, id: string, status: ClinicTreatmentStatus) {
  const { org } = await requireTratamentosAccess(orgSlug)
  const supabase = createClient()
  const { error } = await supabase
    .from('clinic_treatments')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/tratamentos`)
  return { ok: true as const }
}

/** Registra +1 sessão realizada; marca "concluído" automaticamente ao
 *  atingir o total (não deixa sessions_done ultrapassar total_sessions). */
export async function registerClinicTreatmentSession(orgSlug: string, id: string) {
  const { org } = await requireTratamentosAccess(orgSlug)
  const supabase = createClient()
  const { data: t } = await supabase
    .from('clinic_treatments')
    .select('sessions_done, total_sessions, status')
    .eq('id', id)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!t) return { ok: false as const, error: 'Tratamento não encontrado.' }
  const done = Math.min(t.sessions_done + 1, t.total_sessions)
  const status: ClinicTreatmentStatus = done >= t.total_sessions ? 'concluido' : 'em_andamento'
  const { error } = await supabase
    .from('clinic_treatments')
    .update({ sessions_done: done, status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/tratamentos`)
  return { ok: true as const }
}
