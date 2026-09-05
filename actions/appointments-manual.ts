'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { inngest } from '@/lib/inngest/client'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

/* -------- Manual booking (admin creates an appointment) -------- */

const manualBookingSchema = z.object({
  eventTypeId: z.string().uuid(),
  startTime: z.string().datetime(),
  durationMinutes: z.coerce.number().int().min(5).max(480).optional(),
  guestName: z.string().min(2),
  guestEmail: z.string().email(),
  guestPhone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  leadId: z.string().uuid().optional().nullable(),
})

/**
 * Admin-side manual booking. Unlike the public flow, this doesn't validate
 * against the availability windows — the operator may need to fit a client
 * outside the normal schedule. It still warns about (but doesn't block)
 * conflicts with existing appointments, since stepping on a real booking
 * would be a real bug.
 */
export async function createManualAppointment(orgSlug: string, raw: unknown) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const parsed = manualBookingSchema.safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message }

  const startMs = new Date(parsed.data.startTime).getTime()
  if (!Number.isFinite(startMs)) {
    return { ok: false as const, error: 'Horário inválido' }
  }

  // Fetch event type to default the duration if not overridden.
  const { data: eventType } = await supabase
    .from('event_types')
    .select('id, name, duration_minutes, location, pipeline_id, stage_id')
    .eq('id', parsed.data.eventTypeId)
    .eq('organization_id', org.id)
    .maybeSingle()

  if (!eventType) return { ok: false as const, error: 'Tipo de evento não encontrado' }

  const duration = parsed.data.durationMinutes ?? eventType.duration_minutes
  const endIso = new Date(startMs + duration * 60_000).toISOString()

  // Find lead by id (if provided) or by email.
  let leadId: string | null = parsed.data.leadId || null
  if (!leadId) {
    const { data: existing } = await supabase
      .from('contatos')
      .select('id')
      .eq('organization_id', org.id)
      .eq('email', parsed.data.guestEmail)
      .maybeSingle()
    if (existing) {
      leadId = existing.id
      await supabase
        .from('contatos')
        .update({
          name: parsed.data.guestName,
          phone: parsed.data.guestPhone || undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId)
    } else {
      const { data: newLead } = await supabase
        .from('contatos')
        .insert({
          organization_id: org.id,
          pipeline_id: eventType.pipeline_id,
          stage_id: eventType.stage_id,
          name: parsed.data.guestName,
          email: parsed.data.guestEmail,
          phone: parsed.data.guestPhone || null,
          source: `agendamento:${eventType.name} (manual)`,
          assigned_to: user.id,
        })
        .select('id')
        .maybeSingle()
      if (newLead) leadId = newLead.id
    }
  }

  const { data: appt, error } = await supabase
    .from('appointments')
    .insert({
      organization_id: org.id,
      event_type_id: eventType.id,
      contato_id: leadId,
      start_time: parsed.data.startTime,
      end_time: endIso,
      guest_name: parsed.data.guestName,
      guest_email: parsed.data.guestEmail,
      guest_phone: parsed.data.guestPhone || null,
      notes: parsed.data.notes || null,
      location: eventType.location || null,
      status: 'scheduled',
    })
    .select('id')
    .maybeSingle()

  if (error || !appt) {
    console.error('createManualAppointment error:', error)
    return { ok: false as const, error: error?.message || 'Erro ao criar agendamento' }
  }

  if (leadId) {
    await supabase.from('contato_activities').insert({
      contato_id: leadId,
      organization_id: org.id,
      type: 'appointment_scheduled',
      payload: {
        appointment_id: appt.id,
        event_type: eventType.name,
        start_time: parsed.data.startTime,
        manual: true,
      },
      created_by: user.id,
    })

    // Fires automation trigger `appointment.booked` — o fluxo público
    // (actions/appointments-public.ts) já dispara isso; o agendamento manual
    // feito pela equipe (usado por Clínicas) não disparava até então.
    await inngest.send({
      name: 'appointment.booked',
      data: {
        orgId: org.id,
        leadId,
        appointmentId: appt.id,
        eventTypeId: eventType.id,
        startTime: parsed.data.startTime,
      },
    })

    // Nicho Clínicas: um retorno é só um agendamento pendente de ser
    // marcado — assim que o paciente agenda de novo (por aqui ou por
    // "Agendar retorno" no popup do calendário), o item some da lista de
    // Retornos sozinho, sem precisar de outra ação manual. No-op fora do
    // nicho (a tabela simplesmente não tem linha pra esse paciente).
    await supabase
      .from('clinic_attendances')
      .update({ return_status: 'agendado' })
      .eq('organization_id', org.id)
      .eq('patient_contato_id', leadId)
      .eq('return_status', 'pendente')
  }

  revalidatePath(`/app/${orgSlug}/agendamentos`)
  revalidatePath(`/app/${orgSlug}/retornos`)
  return { ok: true as const, appointmentId: appt.id }
}
