'use server'

/**
 * Vertical Clínicas — máquina de estados do agendamento (clinic_status) e
 * lembrete automático (24h antes). Split out of actions/clinic.ts.
 */

import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'
import type { ClinicStatus } from '@/lib/clinic-constants'
import { maybeCreateClinicCommission } from '@/actions/clinic-commissions'
import { consumeSupplyForAttendance } from '@/actions/clinic-estoque'
import { inngest } from '@/lib/inngest/client'
import { requireProfissionaisAccess } from './clinic-directory'

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
