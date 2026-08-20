/**
 * Lembrete automático de agendamento (vertical Clínicas) — roda a cada 30
 * minutos, procura agendamentos que caem numa janela de ~24h a partir de
 * agora (23h30–24h30) sem lembrete enviado ainda, e manda via template
 * aprovado da Meta (fora da janela de 24h de conversa, só template passa).
 *
 * Só age em orgs que: são do nicho Clínicas, têm um template configurado em
 * org_settings.clinic_reminder_template_name, E esse template está com
 * status='approved' em whatsapp_templates — nunca dispara sem aprovação.
 */

import { inngest } from './client'
import { createAdminClient } from '@/lib/supabase/server'
import { sendTemplateMessage } from '@/lib/whatsapp/meta-client'
import { isClinicNiche } from '@/lib/niche'

export const clinicAppointmentReminderCronFn = inngest.createFunction(
  {
    id:      'clinic-appointment-reminder',
    name:    'Clínicas: lembrete de agendamento (24h)',
    retries: 1,
    triggers: [{ cron: '*/30 * * * *' }],
  },
  async ({ step }: { step: any }) => {
    const admin = createAdminClient()

    // 1. Orgs de Clínicas com um template configurado.
    const orgs: Array<{ id: string; niche: string | null; whatsapp_phone_number_id: string | null; whatsapp_access_token: string | null; slug: string }> =
      await step.run('fetch-clinic-orgs', async () => {
        const { data } = await admin
          .from('organizations')
          .select('id, niche, whatsapp_phone_number_id, whatsapp_access_token, slug')
        return (data || []).filter((o: any) => isClinicNiche(o.niche))
      })
    if (orgs.length === 0) return { sent: 0 }

    const orgIds = orgs.map(o => o.id)

    const settingsRows: Array<{ org_id: string; clinic_reminder_template_name: string | null }> =
      await step.run('fetch-reminder-settings', async () => {
        const { data } = await admin
          .from('org_settings')
          .select('org_id, clinic_reminder_template_name')
          .in('org_id', orgIds)
        return data || []
      })
    const templateNameByOrg = new Map(
      settingsRows.filter(s => s.clinic_reminder_template_name).map(s => [s.org_id, s.clinic_reminder_template_name as string]),
    )
    if (templateNameByOrg.size === 0) return { sent: 0 }

    // 2. Só orgs cujo template está aprovado.
    const templateRows: Array<{ organization_id: string; name: string; status: string; language: string }> =
      await step.run('fetch-templates', async () => {
        const { data } = await admin
          .from('whatsapp_templates')
          .select('organization_id, name, status, language')
          .in('organization_id', Array.from(templateNameByOrg.keys()))
        return data || []
      })
    const approvedTemplateByOrg = new Map<string, { name: string; language: string }>()
    for (const t of templateRows) {
      if (t.status === 'approved' && templateNameByOrg.get(t.organization_id) === t.name) {
        approvedTemplateByOrg.set(t.organization_id, { name: t.name, language: t.language || 'pt_BR' })
      }
    }
    if (approvedTemplateByOrg.size === 0) return { sent: 0 }

    const readyOrgIds = Array.from(approvedTemplateByOrg.keys())

    // 3. Agendamentos na janela de ~24h, sem lembrete enviado, ainda
    // agendados/confirmados (não cancelados/reagendados).
    const now = new Date()
    const windowStart = new Date(now.getTime() + 23.5 * 3600_000).toISOString()
    const windowEnd = new Date(now.getTime() + 24.5 * 3600_000).toISOString()

    const contexts: Array<{ appointment_id: string; organization_id: string; clinic_status: string; reminder_sent_at: string | null }> =
      await step.run('fetch-appointment-contexts', async () => {
        const { data } = await admin
          .from('clinic_appointment_context')
          .select('appointment_id, organization_id, clinic_status, reminder_sent_at')
          .in('organization_id', readyOrgIds)
          .in('clinic_status', ['agendado', 'confirmado'])
          .is('reminder_sent_at', null)
        return data || []
      })
    if (contexts.length === 0) return { sent: 0 }

    const appointmentIds = contexts.map(c => c.appointment_id)
    const appointments: Array<{ id: string; start_time: string; guest_name: string; guest_phone: string | null; status: string }> =
      await step.run('fetch-appointments', async () => {
        const { data } = await admin
          .from('appointments')
          .select('id, start_time, guest_name, guest_phone, status')
          .in('id', appointmentIds)
          .eq('status', 'scheduled')
          .gte('start_time', windowStart)
          .lte('start_time', windowEnd)
        return data || []
      })
    if (appointments.length === 0) return { sent: 0 }

    const orgById = new Map(orgs.map(o => [o.id, o]))
    const contextByAppointment = new Map(contexts.map(c => [c.appointment_id, c]))

    let sent = 0
    for (const appt of appointments) {
      if (!appt.guest_phone) continue
      const ctx = contextByAppointment.get(appt.id)
      if (!ctx) continue
      const org = orgById.get(ctx.organization_id)
      const template = approvedTemplateByOrg.get(ctx.organization_id)
      if (!org || !template) continue

      await step.run(`send-reminder-${appt.id}`, async () => {
        const dt = new Date(appt.start_time)
        const dateLabel = dt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' })
        const timeLabel = dt.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })

        await sendTemplateMessage(
          org,
          appt.guest_phone!,
          template.name,
          [appt.guest_name || 'paciente', dateLabel, timeLabel],
          template.language,
        )

        await admin
          .from('clinic_appointment_context')
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq('appointment_id', appt.id)
      })
      sent++
    }

    return { sent }
  },
)
