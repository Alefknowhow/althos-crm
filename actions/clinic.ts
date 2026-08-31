'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'
import type { ClinicStatus } from '@/lib/clinic-constants'
import { maybeCreateClinicCommission } from '@/actions/clinic-commissions'
import { consumeSupplyForAttendance } from '@/actions/clinic-estoque'
import { inngest } from '@/lib/inngest/client'

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
  phone: string | null
  email: string | null
  avatar_storage_object_id: string | null
  /** Preenchido só na leitura (signed URL do R2) — ver resolveClinicProfessionalAvatars. */
  avatar_url?: string | null
  /** Contato que é a fonte de verdade do cadastro pessoal — null nos
   *  profissionais legados (cadastrados antes do vínculo com Contatos). */
  contato_id: string | null
}

/**
 * Cadastro base (nome/foto/telefone/e-mail) vive em `contatos`;
 * clinic_professionals é o VÍNCULO clínico (especialidade/registro/
 * comissão). Faz LEFT JOIN e acha campo-a-campo: contato tem prioridade,
 * cai pros campos legados da própria linha quando não há contato_id
 * (profissional cadastrado antes dessa mudança).
 */
export async function listClinicProfessionals(orgSlug: string): Promise<ClinicProfessional[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('clinic_professionals')
    .select('id, name, specialty_id, registration_no, commission_pct, active, phone, email, avatar_storage_object_id, contato_id, contatos(name, phone, email, avatar_storage_object_id)')
    .eq('organization_id', org.id)
    .order('name', { ascending: true })

  const rows = (data || []).map((r: any) => ({
    id: r.id,
    specialty_id: r.specialty_id,
    registration_no: r.registration_no,
    commission_pct: r.commission_pct,
    active: r.active,
    contato_id: r.contato_id,
    name: r.contatos?.name || r.name,
    phone: r.contatos?.phone ?? r.phone,
    email: r.contatos?.email ?? r.email,
    avatar_storage_object_id: r.contatos?.avatar_storage_object_id ?? r.avatar_storage_object_id,
  }))
  return resolveClinicProfessionalAvatars(orgSlug, rows)
}

/** Resolve avatar_storage_object_id → signed URL do R2 em lote — mesmo
 *  padrão de resolveContatoAvatars (actions/contatos.ts). */
export async function resolveClinicProfessionalAvatars<T extends { avatar_storage_object_id: string | null }>(
  orgSlug: string,
  rows: T[],
): Promise<(T & { avatar_url: string | null })[]> {
  const objectIds = rows.map(r => r.avatar_storage_object_id).filter((id): id is string => !!id)
  if (objectIds.length === 0) return rows.map(r => ({ ...r, avatar_url: null }))
  const { getObjectSignedUrls } = await import('@/actions/storage')
  const urls = await getObjectSignedUrls(orgSlug, objectIds)
  return rows.map(r => ({
    ...r,
    avatar_url: r.avatar_storage_object_id ? urls.get(r.avatar_storage_object_id) ?? null : null,
  }))
}

export type ClinicProfessionalInput = {
  /** Contato que é a fonte de verdade do cadastro pessoal — obrigatório pra
   *  profissionais novos (cadastro base agora é feito em Contatos). */
  contato_id: string
  specialty_id: string | null
  registration_no: string | null
  commission_pct: number | null
}

export async function createClinicProfessional(orgSlug: string, input: ClinicProfessionalInput) {
  const org = await requireProfissionaisAccess(orgSlug)
  if (!input.contato_id) return { ok: false as const, error: 'Selecione um contato.' }
  const supabase = createClient()

  const { data: contato } = await supabase.from('contatos').select('name').eq('id', input.contato_id).eq('organization_id', org.id).maybeSingle()
  if (!contato) return { ok: false as const, error: 'Contato não encontrado.' }

  const { error } = await supabase.from('clinic_professionals').insert({
    organization_id: org.id,
    contato_id: input.contato_id,
    name: contato.name, // cópia denormalizada (fallback caso o contato seja excluído — contato_id vira null via ON DELETE SET NULL)
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
  if (input.contato_id !== undefined) patch.contato_id = input.contato_id || null
  if (input.specialty_id !== undefined) patch.specialty_id = input.specialty_id || null
  if (input.registration_no !== undefined) patch.registration_no = input.registration_no || null
  if (input.commission_pct !== undefined) patch.commission_pct = input.commission_pct
  if (input.active !== undefined) patch.active = input.active
  const { error } = await supabase.from('clinic_professionals').update(patch).eq('id', id).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/profissionais`)
  return { ok: true as const }
}

// Upload de foto/telefone/e-mail do profissional passou a ser feito no
// cadastro do Contato vinculado (actions/contatos.ts::uploadContatoAvatar) —
// removido daqui pra não ter duas fontes de verdade. Profissionais legados
// sem contato_id mantêm os campos próprios (avatar_storage_object_id/phone/
// email) só como fallback de leitura em listClinicProfessionals.

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

export type ClinicServiceContext = {
  specialty_id: string | null
  price_cents: number | null
  room_id: string | null
  /** Desconto padrão pré-aplicado quando o atendimento desse procedimento é
   *  concluído — editável depois por atendimento individual. */
  default_discount_cents?: number
  /** Profissional exclusivo desse procedimento — null = qualquer profissional pode realizá-lo. */
  professional_id?: string | null
}

export async function getClinicServiceContext(orgSlug: string, eventTypeId: string): Promise<ClinicServiceContext | null> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('clinic_service_context')
    .select('specialty_id, price_cents, room_id, default_discount_cents, professional_id')
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
    default_discount_cents: ctx.default_discount_cents ?? 0,
    professional_id: ctx.professional_id || null,
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
  checked_in_at: string | null
  finished_at: string | null
}

export async function listClinicAppointmentContexts(orgSlug: string, appointmentIds: string[]): Promise<Record<string, ClinicAppointmentContext>> {
  if (appointmentIds.length === 0) return {}
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('clinic_appointment_context')
    .select('appointment_id, professional_id, room_id, clinic_status, confirmed_at, no_show_at, checked_in_at, finished_at')
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
      checked_in_at: r.checked_in_at,
      finished_at: r.finished_at,
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

export type ClinicPaymentOverride = {
  total_cents?: number | null
  discount_cents?: number
  payment_method?: string | null
  installments?: number | null
}

/** Avança/altera o status clínico do agendamento. Não mexe no
 *  appointments.status (Core) além dos dois casos óbvios de sincronização
 *  (realizado→completed, cancelado/no_show→canceled) — pra não quebrar
 *  telas/relatórios genéricos que já leem o status Core.
 *
 *  `paymentOverride` só é usado ao avançar pra 'realizado' — permite que a
 *  Agenda capture valor/forma de pagamento/parcelas no momento de
 *  finalizar o atendimento, em vez de sempre cair no preço de tabela do
 *  procedimento (que ainda é o fallback quando nada é passado). */
export async function setClinicAppointmentStatus(
  orgSlug: string,
  appointmentId: string,
  status: ClinicStatus,
  paymentOverride?: ClinicPaymentOverride,
) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const patch: Record<string, unknown> = { clinic_status: status, updated_at: new Date().toISOString() }
  if (status === 'confirmado') patch.confirmed_at = new Date().toISOString()
  if (status === 'no_show') patch.no_show_at = new Date().toISOString()
  // Chegada/finalização — carimbadas com o horário de quando o status
  // passa por aqui (reenviar o mesmo status atualiza o carimbo).
  if (status === 'em_atendimento') patch.checked_in_at = new Date().toISOString()
  if (status === 'realizado') patch.finished_at = new Date().toISOString()

  const { error } = await supabase
    .from('clinic_appointment_context')
    .upsert({ appointment_id: appointmentId, organization_id: org.id, ...patch })
  if (error) return { ok: false as const, error: error.message }

  // Evento de automação (Fase 12) — mesmo motor genérico do Core
  // (lib/inngest/automation.ts), pra permitir que a org configure uma
  // automação (WhatsApp/tarefa/etc.) disparada por confirmação de agenda.
  if (status === 'confirmado') {
    const { data: apptForEvent } = await supabase
      .from('appointments')
      .select('lead_id')
      .eq('id', appointmentId)
      .eq('organization_id', org.id)
      .maybeSingle()
    if (apptForEvent?.lead_id) {
      await inngest.send({
        name: 'clinic.appointment.confirmed',
        data: { orgId: org.id, leadId: apptForEvent.lead_id, appointmentId },
      })
    }
  }

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
        // Preço + desconto default = clinic_service_context do tipo de
        // evento, se cadastrado — sobrescrito por paymentOverride quando a
        // Agenda captura o valor/forma de pagamento reais ao finalizar.
        let priceCents: number | null = null
        let discountCents = 0
        if (appt.event_type_id) {
          const { data: svcCtx } = await supabase
            .from('clinic_service_context')
            .select('price_cents, default_discount_cents')
            .eq('event_type_id', appt.event_type_id)
            .eq('organization_id', org.id)
            .maybeSingle()
          priceCents = svcCtx?.price_cents ?? null
          discountCents = svcCtx?.default_discount_cents || 0
        }
        if (paymentOverride) {
          if (paymentOverride.total_cents !== undefined) priceCents = paymentOverride.total_cents
          if (paymentOverride.discount_cents !== undefined) discountCents = paymentOverride.discount_cents
        }
        const netCents = priceCents != null ? Math.max(0, priceCents - discountCents) : null

        // Lançamento em Financeiro (Core) — mesmo padrão que
        // clinic_packages.financial_entry_id já usa. Sem isso, um
        // atendimento concluído gerava comissão pro profissional sem
        // nunca ter lançado a receita que a originou.
        let financialEntryId: string | null = null
        if (netCents && netCents > 0) {
          const { data: entry } = await supabase
            .from('financial_entries')
            .insert({
              organization_id: org.id,
              tipo: 'receita',
              categoria: 'Atendimento clínico',
              valor_cents: netCents,
              contato_id: appt.lead_id,
              status: 'pendente',
              competencia: (appt.start_time || new Date().toISOString()).slice(0, 10),
              forma_pagamento: paymentOverride?.payment_method || null,
            })
            .select('id')
            .maybeSingle()
          financialEntryId = entry?.id ?? null
        }

        const { data: attendance } = await supabase
          .from('clinic_attendances')
          .insert({
            organization_id: org.id,
            appointment_id: appointmentId,
            patient_contato_id: appt.lead_id,
            professional_id: ctx?.professional_id || null,
            event_type_id: appt.event_type_id || null,
            attended_at: appt.start_time || new Date().toISOString(),
            total_cents: priceCents,
            discount_cents: discountCents,
            payment_method: paymentOverride?.payment_method || null,
            installments: paymentOverride?.installments ?? null,
            financial_entry_id: financialEntryId,
          })
          .select('id')
          .maybeSingle()

        // Comissão automática — base = valor líquido (preço - desconto do
        // procedimento), se houver serviço e profissional vinculados.
        if (attendance && netCents) {
          await maybeCreateClinicCommission({
            organizationId: org.id,
            professionalId: ctx?.professional_id || null,
            patientContatoId: appt.lead_id,
            sourceType: 'atendimento',
            sourceId: attendance.id,
            baseAmountCents: netCents,
          })
        }

        // Baixa automática de insumos (Estoque) — consome a receita
        // cadastrada em clinic_supply_recipe para o procedimento, se
        // houver. Sem receita cadastrada, não faz nada (opcional por
        // procedimento).
        if (attendance) {
          await consumeSupplyForAttendance({
            organizationId: org.id,
            eventTypeId: appt.event_type_id || null,
            attendanceId: attendance.id,
            professionalId: ctx?.professional_id || null,
            patientContatoId: appt.lead_id,
          })

          await inngest.send({
            name: 'clinic.attendance.completed',
            data: { orgId: org.id, leadId: appt.lead_id, attendanceId: attendance.id },
          })
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
