'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'

/**
 * Vertical Clínicas — Prontuário. Timeline de evoluções clínicas (formato
 * SOAP) por paciente, separada de clinic_attendances (operacional/
 * comercial). MÓDULO OCULTO por padrão — ver lib/niche-modules.ts
 * (PRONTUARIO_ENABLED) e docs/audit/clinicas-lgpd.md.
 *
 * Toda operação grava em clinic_data_access_log — pré-requisito de
 * compliance (item 1 da recomendação da auditoria) antes desse tipo de
 * dado sensível ficar acessível de verdade.
 */

async function requireProntuarioAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'prontuario_clinica')
  if (!check.allowed) throw new Error(check.reason || 'Sem permissão')
  return { org, user }
}

async function logAccess(
  supabase: ReturnType<typeof createClient>,
  params: { organizationId: string; userId: string; action: 'view' | 'create' | 'update' | 'delete'; patientContatoId: string | null; recordId?: string | null },
) {
  await supabase.from('clinic_data_access_log').insert({
    organization_id: params.organizationId,
    user_id: params.userId,
    action: params.action,
    patient_contato_id: params.patientContatoId,
    record_id: params.recordId ?? null,
  })
}

export type ClinicMedicalRecordRow = {
  id: string
  patient_contato_id: string
  professional_id: string | null
  professional_name: string | null
  attendance_id: string | null
  entry_date: string
  subjective: string | null
  objective: string | null
  assessment: string | null
  plan: string | null
  created_at: string
}

/** Timeline de um paciente — grava um log 'view' por chamada (abrir o prontuário de alguém é, em si, um acesso a dado sensível). */
export async function listClinicMedicalRecords(orgSlug: string, patientContatoId: string): Promise<ClinicMedicalRecordRow[]> {
  const { org, user } = await requireProntuarioAccess(orgSlug)
  const supabase = createClient()

  const { data } = await supabase
    .from('clinic_medical_records')
    .select('id, patient_contato_id, professional_id, attendance_id, entry_date, subjective, objective, assessment, plan, created_at, clinic_professionals(name)')
    .eq('organization_id', org.id)
    .eq('patient_contato_id', patientContatoId)
    .is('deleted_at', null)
    .order('entry_date', { ascending: false })

  await logAccess(supabase, { organizationId: org.id, userId: user.id, action: 'view', patientContatoId })

  return (data || []).map((r: any) => ({
    id: r.id,
    patient_contato_id: r.patient_contato_id,
    professional_id: r.professional_id,
    professional_name: r.clinic_professionals?.name || null,
    attendance_id: r.attendance_id,
    entry_date: r.entry_date,
    subjective: r.subjective,
    objective: r.objective,
    assessment: r.assessment,
    plan: r.plan,
    created_at: r.created_at,
  }))
}

export type ClinicMedicalRecordInput = {
  patient_contato_id: string
  professional_id: string | null
  attendance_id: string | null
  entry_date: string
  subjective: string | null
  objective: string | null
  assessment: string | null
  plan: string | null
}

export async function createClinicMedicalRecord(orgSlug: string, input: ClinicMedicalRecordInput) {
  const { org, user } = await requireProntuarioAccess(orgSlug)
  if (!input.patient_contato_id) return { ok: false as const, error: 'Selecione o paciente.' }
  const supabase = createClient()

  const { data, error } = await supabase
    .from('clinic_medical_records')
    .insert({
      organization_id: org.id,
      patient_contato_id: input.patient_contato_id,
      professional_id: input.professional_id || null,
      attendance_id: input.attendance_id || null,
      entry_date: input.entry_date || new Date().toISOString(),
      subjective: input.subjective || null,
      objective: input.objective || null,
      assessment: input.assessment || null,
      plan: input.plan || null,
      created_by: user.id,
    })
    .select('id')
    .maybeSingle()
  if (error || !data) return { ok: false as const, error: error?.message || 'Erro ao criar evolução' }

  await logAccess(supabase, { organizationId: org.id, userId: user.id, action: 'create', patientContatoId: input.patient_contato_id, recordId: data.id })
  revalidatePath(`/app/${orgSlug}/prontuario`)
  return { ok: true as const }
}

export async function updateClinicMedicalRecord(orgSlug: string, id: string, input: Partial<ClinicMedicalRecordInput>) {
  const { org, user } = await requireProntuarioAccess(orgSlug)
  const supabase = createClient()
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.professional_id !== undefined) patch.professional_id = input.professional_id || null
  if (input.attendance_id !== undefined) patch.attendance_id = input.attendance_id || null
  if (input.entry_date !== undefined) patch.entry_date = input.entry_date
  if (input.subjective !== undefined) patch.subjective = input.subjective || null
  if (input.objective !== undefined) patch.objective = input.objective || null
  if (input.assessment !== undefined) patch.assessment = input.assessment || null
  if (input.plan !== undefined) patch.plan = input.plan || null

  const { data, error } = await supabase
    .from('clinic_medical_records')
    .update(patch)
    .eq('id', id)
    .eq('organization_id', org.id)
    .select('patient_contato_id')
    .maybeSingle()
  if (error) return { ok: false as const, error: error.message }

  await logAccess(supabase, { organizationId: org.id, userId: user.id, action: 'update', patientContatoId: data?.patient_contato_id ?? null, recordId: id })
  revalidatePath(`/app/${orgSlug}/prontuario`)
  return { ok: true as const }
}

/**
 * "Excluir" um registro de prontuário nunca é exclusão física — a
 * Resolução CFM nº 1.821/2007 exige guarda mínima de 20 anos do
 * prontuário. Isso soft-deleta (marca deleted_at/deleted_by, some da
 * timeline) em vez de apagar a linha; um expurgo de verdade depois do
 * prazo legal é um processo administrativo separado, fora do escopo desta
 * action do dia a dia.
 */
/* -------- Consentimento (item 4 da auditoria LGPD) -------- */

export type ClinicPatientConsent = {
  id: string
  method: 'verbal' | 'termo_assinado' | 'digital'
  given_at: string
  notes: string | null
}

/** Consentimento ATIVO do paciente (o mais recente sem revogação) — null se nunca deu ou se o único registro foi revogado. */
export async function getActiveClinicConsent(orgSlug: string, patientContatoId: string): Promise<ClinicPatientConsent | null> {
  const { org } = await requireProntuarioAccess(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('clinic_patient_consents')
    .select('id, method, given_at, notes')
    .eq('organization_id', org.id)
    .eq('patient_contato_id', patientContatoId)
    .eq('consent_type', 'dados_saude')
    .is('revoked_at', null)
    .order('given_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

export async function recordClinicConsent(
  orgSlug: string,
  patientContatoId: string,
  method: 'verbal' | 'termo_assinado' | 'digital',
  notes?: string | null,
) {
  const { org, user } = await requireProntuarioAccess(orgSlug)
  const supabase = createClient()
  const { error } = await supabase.from('clinic_patient_consents').insert({
    organization_id: org.id,
    patient_contato_id: patientContatoId,
    consent_type: 'dados_saude',
    method,
    given_by: user.id,
    notes: notes || null,
  })
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/prontuario`)
  return { ok: true as const }
}

export async function revokeClinicConsent(orgSlug: string, consentId: string) {
  const { org, user } = await requireProntuarioAccess(orgSlug)
  const supabase = createClient()
  const { error } = await supabase
    .from('clinic_patient_consents')
    .update({ revoked_at: new Date().toISOString(), revoked_by: user.id })
    .eq('id', consentId)
    .eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/prontuario`)
  return { ok: true as const }
}

export async function deleteClinicMedicalRecord(orgSlug: string, id: string) {
  const { org, user } = await requireProntuarioAccess(orgSlug)
  const supabase = createClient()

  const { data: existing, error } = await supabase
    .from('clinic_medical_records')
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
    .eq('id', id)
    .eq('organization_id', org.id)
    .select('patient_contato_id')
    .maybeSingle()
  if (error) return { ok: false as const, error: error.message }

  await logAccess(supabase, { organizationId: org.id, userId: user.id, action: 'delete', patientContatoId: existing?.patient_contato_id ?? null, recordId: id })
  revalidatePath(`/app/${orgSlug}/prontuario`)
  return { ok: true as const }
}
