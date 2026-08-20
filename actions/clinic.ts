'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'
import type { ClinicStatus } from '@/lib/clinic-constants'
import { maybeCreateClinicCommission } from '@/actions/clinic-commissions'

/**
 * Vertical Clínicas — Fase 1 (fundação): CRUD de especialidades,
 * profissionais e salas, contexto clínico do serviço (event_types) e
 * máquina de estados do agendamento (clinic_appointment_context).
 * Ver supabase/migrations/0164_clinic_vertical_foundation.sql.
 */

async function requireProfissionaisAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'profissionais')
  if (!check.allowed) throw new Error(check.reason || 'Sem permissão')
  return org
}

// ── Especialidades ──────────────────────────────────────────────────────────

export type ClinicSpecialty = { id: string; name: string; active: boolean }

export async function listClinicSpecialties(orgSlug: string): Promise<ClinicSpecialty[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('clinic_specialties')
    .select('id, name, active')
    .eq('organization_id', org.id)
    .order('name', { ascending: true })
  return data || []
}

export async function createClinicSpecialty(orgSlug: string, name: string) {
  const org = await requireProfissionaisAccess(orgSlug)
  const trimmed = name.trim()
  if (!trimmed) return { ok: false as const, error: 'Nome é obrigatório.' }
  const supabase = createClient()
  const { error } = await supabase.from('clinic_specialties').insert({ organization_id: org.id, name: trimmed })
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/profissionais`)
  return { ok: true as const }
}

export async function updateClinicSpecialty(orgSlug: string, id: string, patch: { name?: string; active?: boolean }) {
  const org = await requireProfissionaisAccess(orgSlug)
  const supabase = createClient()
  const { error } = await supabase.from('clinic_specialties').update(patch).eq('id', id).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/profissionais`)
  return { ok: true as const }
}

export async function deleteClinicSpecialty(orgSlug: string, id: string) {
  const org = await requireProfissionaisAccess(orgSlug)
  const supabase = createClient()
  const { error } = await supabase.from('clinic_specialties').delete().eq('id', id).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/profissionais`)
  return { ok: true as const }
}

// ── Profissionais ────────────────────────────────────────────────────────────

export type ClinicProfessional = {
  id: string
  name: string
  specialty_id: string | null
  registration_no: string | null
  commission_pct: number | null
  active: boolean
}

export async function listClinicProfessionals(orgSlug: string): Promise<ClinicProfessional[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('clinic_professionals')
    .select('id, name, specialty_id, registration_no, commission_pct, active')
    .eq('organization_id', org.id)
    .order('name', { ascending: true })
  return data || []
}

export type ClinicProfessionalInput = {
  name: string
  specialty_id: string | null
  registration_no: string | null
  commission_pct: number | null
}

export async function createClinicProfessional(orgSlug: string, input: ClinicProfessionalInput) {
  const org = await requireProfissionaisAccess(orgSlug)
  if (!input.name.trim()) return { ok: false as const, error: 'Nome é obrigatório.' }
  const supabase = createClient()
  const { error } = await supabase.from('clinic_professionals').insert({
    organization_id: org.id,
    name: input.name.trim(),
    specialty_id: input.specialty_id || null,
    registration_no: input.registration_no || null,
    commission_pct: input.commission_pct ?? null,
  })
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/profissionais`)
  return { ok: true as const }
}

export async function updateClinicProfessional(orgSlug: string, id: string, input: Partial<ClinicProfessionalInput> & { active?: boolean }) {
  const org = await requireProfissionaisAccess(orgSlug)
  const supabase = createClient()
  const patch: Record<string, unknown> = {}
  if (input.name !== undefined) patch.name = input.name.trim()
  if (input.specialty_id !== undefined) patch.specialty_id = input.specialty_id || null
  if (input.registration_no !== undefined) patch.registration_no = input.registration_no || null
  if (input.commission_pct !== undefined) patch.commission_pct = input.commission_pct
  if (input.active !== undefined) patch.active = input.active
  const { error } = await supabase.from('clinic_professionals').update(patch).eq('id', id).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/profissionais`)
  return { ok: true as const }
}

export async function deleteClinicProfessional(orgSlug: string, id: string) {
  const org = await requireProfissionaisAccess(orgSlug)
  const supabase = createClient()
  const { error } = await supabase.from('clinic_professionals').delete().eq('id', id).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/profissionais`)
  return { ok: true as const }
}

// ── Salas ────────────────────────────────────────────────────────────────────

export type ClinicRoom = { id: string; name: string; active: boolean }

export async function listClinicRooms(orgSlug: string): Promise<ClinicRoom[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('clinic_rooms')
    .select('id, name, active')
    .eq('organization_id', org.id)
    .order('name', { ascending: true })
  return data || []
}

export async function createClinicRoom(orgSlug: string, name: string) {
  const org = await requireProfissionaisAccess(orgSlug)
  const trimmed = name.trim()
  if (!trimmed) return { ok: false as const, error: 'Nome é obrigatório.' }
  const supabase = createClient()
  const { error } = await supabase.from('clinic_rooms').insert({ organization_id: org.id, name: trimmed })
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/profissionais`)
  return { ok: true as const }
}

export async function updateClinicRoom(orgSlug: string, id: string, patch: { name?: string; active?: boolean }) {
  const org = await requireProfissionaisAccess(orgSlug)
  const supabase = createClient()
  const { error } = await supabase.from('clinic_rooms').update(patch).eq('id', id).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/profissionais`)
  return { ok: true as const }
}

export async function deleteClinicRoom(orgSlug: string, id: string) {
  const org = await requireProfissionaisAccess(orgSlug)
  const supabase = createClient()
  const { error } = await supabase.from('clinic_rooms').delete().eq('id', id).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/profissionais`)
  return { ok: true as const }
}

// ── Contexto clínico do serviço (event_types) ───────────────────────────────

export type ClinicServiceContext = { specialty_id: string | null; price_cents: number | null; room_id: string | null }

export async function getClinicServiceContext(orgSlug: string, eventTypeId: string): Promise<ClinicServiceContext | null> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('clinic_service_context')
    .select('specialty_id, price_cents, room_id')
    .eq('event_type_id', eventTypeId)
    .eq('organization_id', org.id)
    .maybeSingle()
  return data
}

/** Upsert — chamado junto de createEventType/updateEventType quando o nicho é clínica. */
export async function upsertClinicServiceContext(orgSlug: string, eventTypeId: string, ctx: ClinicServiceContext) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { error } = await supabase.from('clinic_service_context').upsert({
    event_type_id: eventTypeId,
    organization_id: org.id,
    specialty_id: ctx.specialty_id || null,
    price_cents: ctx.price_cents ?? null,
    room_id: ctx.room_id || null,
  })
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/agendamentos`)
  return { ok: true as const }
}

// ── Contexto clínico do agendamento (appointments) ──────────────────────────

export type ClinicAppointmentContext = {
  professional_id: string | null
  room_id: string | null
  clinic_status: string
  confirmed_at: string | null
  no_show_at: string | null
}

export async function listClinicAppointmentContexts(orgSlug: string, appointmentIds: string[]): Promise<Record<string, ClinicAppointmentContext>> {
  if (appointmentIds.length === 0) return {}
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('clinic_appointment_context')
    .select('appointment_id, professional_id, room_id, clinic_status, confirmed_at, no_show_at')
    .eq('organization_id', org.id)
    .in('appointment_id', appointmentIds)
  const out: Record<string, ClinicAppointmentContext> = {}
  for (const r of data || []) {
    out[r.appointment_id] = {
      professional_id: r.professional_id,
      room_id: r.room_id,
      clinic_status: r.clinic_status,
      confirmed_at: r.confirmed_at,
      no_show_at: r.no_show_at,
    }
  }
  return out
}

/** Cria/atualiza o contexto clínico do agendamento (profissional/sala) —
 *  chamado junto da criação/edição do agendamento quando o nicho é clínica. */
export async function upsertClinicAppointmentContext(
  orgSlug: string,
  appointmentId: string,
  ctx: { professional_id: string | null; room_id: string | null },
) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { error } = await supabase.from('clinic_appointment_context').upsert({
    appointment_id: appointmentId,
    organization_id: org.id,
    professional_id: ctx.professional_id || null,
    room_id: ctx.room_id || null,
  })
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/agendamentos`)
  return { ok: true as const }
}

/** Avança/altera o status clínico do agendamento. Não mexe no
 *  appointments.status (Core) além dos dois casos óbvios de sincronização
 *  (realizado→completed, cancelado/no_show→canceled) — pra não quebrar
 *  telas/relatórios genéricos que já leem o status Core. */
export async function setClinicAppointmentStatus(orgSlug: string, appointmentId: string, status: ClinicStatus) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const patch: Record<string, unknown> = { clinic_status: status, updated_at: new Date().toISOString() }
  if (status === 'confirmado') patch.confirmed_at = new Date().toISOString()
  if (status === 'no_show') patch.no_show_at = new Date().toISOString()

  const { error } = await supabase
    .from('clinic_appointment_context')
    .upsert({ appointment_id: appointmentId, organization_id: org.id, ...patch })
  if (error) return { ok: false as const, error: error.message }

  // Sincronização mínima com o status Core (appointments.status).
  if (status === 'realizado') {
    await supabase.from('appointments').update({ status: 'completed' }).eq('id', appointmentId).eq('organization_id', org.id)

    // Cria automaticamente um registro de atendimento (Fase 5) — se ainda
    // não existir um pra esse agendamento (idempotente via unique index em
    // appointment_id). Preenche o mínimo a partir do próprio agendamento;
    // o profissional preenche observações/recomendações/retorno depois.
    const { data: appt } = await supabase
      .from('appointments')
      .select('lead_id, event_type_id, start_time')
      .eq('id', appointmentId)
      .eq('organization_id', org.id)
      .maybeSingle()
    const { data: ctx } = await supabase
      .from('clinic_appointment_context')
      .select('professional_id')
      .eq('appointment_id', appointmentId)
      .eq('organization_id', org.id)
      .maybeSingle()
    if (appt?.lead_id) {
      const { data: existing } = await supabase
        .from('clinic_attendances')
        .select('id')
        .eq('appointment_id', appointmentId)
        .maybeSingle()
      if (!existing) {
        const { data: attendance } = await supabase
          .from('clinic_attendances')
          .insert({
            organization_id: org.id,
            appointment_id: appointmentId,
            patient_contato_id: appt.lead_id,
            professional_id: ctx?.professional_id || null,
            event_type_id: appt.event_type_id || null,
            attended_at: appt.start_time || new Date().toISOString(),
          })
          .select('id')
          .maybeSingle()

        // Comissão automática — base = preço cadastrado no contexto
        // clínico do serviço (clinic_service_context.price_cents), se
        // houver serviço e profissional vinculados.
        if (attendance && appt.event_type_id) {
          const { data: svcCtx } = await supabase
            .from('clinic_service_context')
            .select('price_cents')
            .eq('event_type_id', appt.event_type_id)
            .eq('organization_id', org.id)
            .maybeSingle()
          if (svcCtx?.price_cents) {
            await maybeCreateClinicCommission({
              organizationId: org.id,
              professionalId: ctx?.professional_id || null,
              patientContatoId: appt.lead_id,
              sourceType: 'atendimento',
              sourceId: attendance.id,
              baseAmountCents: svcCtx.price_cents,
            })
          }
        }
      }
    }
  } else if (status === 'cancelado' || status === 'no_show') {
    await supabase.from('appointments').update({ status: 'canceled' }).eq('id', appointmentId).eq('organization_id', org.id)
  }

  revalidatePath(`/app/${orgSlug}/agendamentos`)
  revalidatePath(`/app/${orgSlug}/atendimentos`)
  return { ok: true as const }
}

// ── Lembrete automático (24h antes) — template + status ─────────────────────

const REMINDER_TEMPLATE_NAME = 'lembrete_agendamento_24h'

export type ClinicReminderSettings = {
  templateName: string | null
  templateStatus: 'local' | 'pending' | 'approved' | 'rejected' | null
}

export async function getClinicReminderSettings(orgSlug: string): Promise<ClinicReminderSettings> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data: settings } = await supabase
    .from('org_settings')
    .select('clinic_reminder_template_name')
    .eq('org_id', org.id)
    .maybeSingle()

  const templateName = settings?.clinic_reminder_template_name ?? null
  if (!templateName) return { templateName: null, templateStatus: null }

  const { data: tpl } = await supabase
    .from('whatsapp_templates')
    .select('status')
    .eq('organization_id', org.id)
    .eq('name', templateName)
    .maybeSingle()

  return { templateName, templateStatus: (tpl?.status as any) ?? null }
}

/**
 * Cria (se ainda não existir) um template de lembrete padrão como rascunho
 * local, e configura org_settings pra usá-lo. O operador ainda precisa ir em
 * Templates WhatsApp e clicar "Enviar para aprovação" — o cron de lembrete
 * só envia depois que o status virar 'approved' na Meta.
 */
export async function ensureClinicReminderTemplate(orgSlug: string) {
  const org = await requireProfissionaisAccess(orgSlug)
  const supabase = createClient()

  const { data: existing } = await supabase
    .from('whatsapp_templates')
    .select('id, name')
    .eq('organization_id', org.id)
    .eq('name', REMINDER_TEMPLATE_NAME)
    .maybeSingle()

  if (!existing) {
    const { error: createError } = await supabase.from('whatsapp_templates').insert({
      organization_id: org.id,
      name: REMINDER_TEMPLATE_NAME,
      display_name: 'Lembrete de agendamento (24h)',
      category: 'UTILITY',
      language: 'pt_BR',
      header_type: 'none',
      header_text: null,
      header_media_url: null,
      body_text: 'Olá, {{1}}! Passando para lembrar do seu horário amanhã, {{2}} às {{3}}. Até lá! 😊',
      variable_names: ['nome do paciente', 'data', 'horário'],
      footer_text: null,
      status: 'local',
    })
    if (createError) return { ok: false as const, error: createError.message }
  }

  const { error: settingsError } = await supabase
    .from('org_settings')
    .upsert({ org_id: org.id, clinic_reminder_template_name: REMINDER_TEMPLATE_NAME }, { onConflict: 'org_id' })
  if (settingsError) return { ok: false as const, error: settingsError.message }

  revalidatePath(`/app/${orgSlug}/agendamentos`)
  revalidatePath(`/app/${orgSlug}/whatsapp-templates`)
  return { ok: true as const }
}
