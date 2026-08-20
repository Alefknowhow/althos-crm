'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'
import type { ClinicWaitlistStatus } from '@/lib/clinic-constants'

/**
 * Vertical Clínicas — Fase 7: Lista de espera. Sem disparo automático —
 * a equipe consulta a lista e entra em contato manualmente. Ver
 * supabase/migrations/0169_clinic_waitlist.sql.
 */

async function requireWaitlistAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'lista_espera_clinica')
  if (!check.allowed) throw new Error(check.reason || 'Sem permissão')
  return { org, user }
}

export type ClinicWaitlistRow = {
  id: string
  patient_contato_id: string
  patient_name: string
  professional_id: string | null
  professional_name: string | null
  event_type_id: string | null
  service_name: string | null
  preferred_from: string | null
  preferred_until: string | null
  preferred_time: string | null
  notes: string | null
  status: ClinicWaitlistStatus
  created_at: string
}

export async function listClinicWaitlist(orgSlug: string): Promise<ClinicWaitlistRow[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('clinic_waitlist')
    .select('id, patient_contato_id, professional_id, event_type_id, preferred_from, preferred_until, preferred_time, notes, status, created_at, contatos(name), clinic_professionals(name), event_types(name)')
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
    preferred_from: r.preferred_from,
    preferred_until: r.preferred_until,
    preferred_time: r.preferred_time,
    notes: r.notes,
    status: r.status,
    created_at: r.created_at,
  }))
}

export type ClinicWaitlistInput = {
  patient_contato_id: string
  professional_id: string | null
  event_type_id: string | null
  preferred_from: string | null
  preferred_until: string | null
  preferred_time: string | null
  notes: string | null
}

export async function createClinicWaitlistEntry(orgSlug: string, input: ClinicWaitlistInput) {
  const { org, user } = await requireWaitlistAccess(orgSlug)
  if (!input.patient_contato_id) return { ok: false as const, error: 'Selecione o paciente.' }
  const supabase = createClient()
  const { error } = await supabase.from('clinic_waitlist').insert({
    organization_id: org.id,
    patient_contato_id: input.patient_contato_id,
    professional_id: input.professional_id || null,
    event_type_id: input.event_type_id || null,
    preferred_from: input.preferred_from || null,
    preferred_until: input.preferred_until || null,
    preferred_time: input.preferred_time || null,
    notes: input.notes || null,
    created_by: user.id,
  })
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/lista-espera`)
  return { ok: true as const }
}

export async function updateClinicWaitlistEntry(orgSlug: string, id: string, input: Partial<ClinicWaitlistInput>) {
  const { org } = await requireWaitlistAccess(orgSlug)
  const supabase = createClient()
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.professional_id !== undefined) patch.professional_id = input.professional_id || null
  if (input.event_type_id !== undefined) patch.event_type_id = input.event_type_id || null
  if (input.preferred_from !== undefined) patch.preferred_from = input.preferred_from || null
  if (input.preferred_until !== undefined) patch.preferred_until = input.preferred_until || null
  if (input.preferred_time !== undefined) patch.preferred_time = input.preferred_time || null
  if (input.notes !== undefined) patch.notes = input.notes || null
  const { error } = await supabase.from('clinic_waitlist').update(patch).eq('id', id).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/lista-espera`)
  return { ok: true as const }
}

export async function deleteClinicWaitlistEntry(orgSlug: string, id: string) {
  const { org } = await requireWaitlistAccess(orgSlug)
  const supabase = createClient()
  const { error } = await supabase.from('clinic_waitlist').delete().eq('id', id).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/lista-espera`)
  return { ok: true as const }
}

export async function setClinicWaitlistStatus(orgSlug: string, id: string, status: ClinicWaitlistStatus) {
  const { org } = await requireWaitlistAccess(orgSlug)
  const supabase = createClient()
  const { error } = await supabase
    .from('clinic_waitlist')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/lista-espera`)
  return { ok: true as const }
}
