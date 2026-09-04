'use server'

/**
 * Public (anonymous) booking flow: resolve event type, compute
 * available slots, and create a public appointment.
 * Split out of actions/appointments.ts.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { inngest } from '@/lib/inngest/client'
import { runAntispamGauntlet } from '@/lib/security/antispam'

/* -------- Public: slot computation + booking -------- */

/**
 * Resolve org + event type from URL slugs. Uses admin client because the
 * booker is anonymous (no auth, no cookie).
 */
export async function resolvePublicEventType(orgSlug: string, eventSlug: string) {
  const admin = createAdminClient()
  const { data: org } = await admin
    .from('organizations')
    .select('id, name')
    .eq('slug', orgSlug)
    .maybeSingle()
  if (!org) return { org: null, eventType: null }

  const { data: eventType } = await admin
    .from('event_types')
    .select(
      'id, name, slug, description, duration_minutes, location, color, buffer_before_minutes, buffer_after_minutes, pipeline_id, stage_id',
    )
    .eq('organization_id', org.id)
    .eq('slug', eventSlug)
    .eq('is_active', true)
    .maybeSingle()

  return { org, eventType }
}

/**
 * Resolve an org + ALL of its active event types for the public org-level
 * booking landing page (`/book/[orgSlug]`). Admin client because the booker is
 * anonymous; only active event types are exposed.
 */
export async function resolvePublicOrgEventTypes(orgSlug: string) {
  const admin = createAdminClient()
  const { data: org } = await admin
    .from('organizations')
    .select('id, name')
    .eq('slug', orgSlug)
    .maybeSingle()
  if (!org) return { org: null, eventTypes: [] }

  const { data: eventTypes } = await admin
    .from('event_types')
    .select('id, name, slug, description, duration_minutes, location, color')
    .eq('organization_id', org.id)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  return { org, eventTypes: eventTypes ?? [] }
}

/**
 * Compute available slots for a given event type + date.
 *
 * Rules:
 *   1) Use event-specific availability if present, otherwise org-wide.
 *   2) Step by (duration + before-buffer + after-buffer).
 *   3) Skip slots overlapping any non-canceled appointment.
 *   4) Skip slots in the past.
 *
 * Timezone is fixed to America/Sao_Paulo for v1. The cheap `-03:00` suffix
 * ignores DST, which is fine until we support multiple regions or BR adopts
 * DST again — at that point we add `organizations.timezone` and switch to a
 * tz library (e.g., date-fns-tz).
 */
export async function getAvailableSlots(
  orgSlug: string,
  eventSlug: string,
  dateStr: string,
): Promise<{ slots: string[]; durationMinutes: number; eventTypeId: string | null }> {
  const admin = createAdminClient()
  const { org, eventType } = await resolvePublicEventType(orgSlug, eventSlug)
  if (!org || !eventType) return { slots: [], durationMinutes: 30, eventTypeId: null }

  const dayStart = new Date(`${dateStr}T00:00:00-03:00`)
  const dayEnd = new Date(`${dateStr}T23:59:59-03:00`)
  if (isNaN(dayStart.getTime())) {
    return { slots: [], durationMinutes: eventType.duration_minutes, eventTypeId: eventType.id }
  }

  const dow = dayStart.getDay()

  // Prefer event-type-specific availability; fall back to org-wide.
  const { data: eventAv } = await admin
    .from('availabilities')
    .select('start_time, end_time')
    .eq('organization_id', org.id)
    .eq('event_type_id', eventType.id)
    .eq('day_of_week', dow)

  let windows = eventAv || []
  if (windows.length === 0) {
    const { data: orgAv } = await admin
      .from('availabilities')
      .select('start_time, end_time')
      .eq('organization_id', org.id)
      .is('event_type_id', null)
      .eq('day_of_week', dow)
    windows = orgAv || []
  }
  if (windows.length === 0) {
    return { slots: [], durationMinutes: eventType.duration_minutes, eventTypeId: eventType.id }
  }

  const { data: existing } = await admin
    .from('appointments')
    .select('start_time, end_time, status')
    .eq('organization_id', org.id)
    .neq('status', 'canceled')
    .gte('start_time', dayStart.toISOString())
    .lte('start_time', dayEnd.toISOString())

  const busy = (existing || []).map(a => ({
    start: new Date(a.start_time).getTime(),
    end: new Date(a.end_time).getTime(),
  }))

  const duration = eventType.duration_minutes
  const buffer = (eventType.buffer_before_minutes || 0) + (eventType.buffer_after_minutes || 0)
  const step = duration + buffer
  const now = Date.now()
  const slots: string[] = []

  for (const w of windows) {
    const wStart = new Date(`${dateStr}T${w.start_time}-03:00`).getTime()
    const wEnd = new Date(`${dateStr}T${w.end_time}-03:00`).getTime()
    if (!Number.isFinite(wStart) || !Number.isFinite(wEnd)) continue

    for (let t = wStart; t + duration * 60_000 <= wEnd; t += step * 60_000) {
      const slotStart = t
      const slotEnd = t + duration * 60_000
      if (slotStart <= now) continue
      const overlaps = busy.some(b => !(slotEnd <= b.start || slotStart >= b.end))
      if (overlaps) continue
      slots.push(new Date(slotStart).toISOString())
    }
  }

  return { slots, durationMinutes: duration, eventTypeId: eventType.id }
}

const publicBookingSchema = z.object({
  orgSlug: z.string(),
  eventSlug: z.string(),
  startTime: z.string().datetime(),
  guestName: z.string().min(2),
  guestEmail: z.string().email(),
  guestPhone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  // Anti-spam payload (all optional — the gauntlet handles missing fields).
  honeypot: z.string().optional().nullable(),
  formMountedAt: z.number().optional().nullable(),
  turnstileToken: z.string().optional().nullable(),
})

/**
 * Public booking: validates slot is still available (between view and submit),
 * creates/dedupes the lead, inserts the appointment, fires an event for
 * downstream notifications (Inngest will email a confirmation).
 */
export async function createPublicAppointment(input: z.infer<typeof publicBookingSchema>) {
  const parsed = publicBookingSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message }

  // Anti-spam gauntlet before any DB work. Generic error on block.
  const guard = await runAntispamGauntlet(
    `public_booking:${parsed.data.orgSlug}:${parsed.data.eventSlug}`,
    {
      honeypotValue: parsed.data.honeypot ?? null,
      formMountedAt: parsed.data.formMountedAt ?? null,
      turnstileToken: parsed.data.turnstileToken ?? null,
    },
    { maxPerWindow: 8, windowMinutes: 60 },
  )
  if (!guard.ok) {
    console.warn(`[antispam] blocked createPublicAppointment reason=${guard.reason}`)
    return { ok: false as const, error: 'Erro ao criar agendamento. Tente novamente em alguns minutos.' }
  }

  const admin = createAdminClient()
  const { org, eventType } = await resolvePublicEventType(parsed.data.orgSlug, parsed.data.eventSlug)
  if (!org || !eventType) return { ok: false as const, error: 'Tipo de evento não encontrado' }

  const startMs = new Date(parsed.data.startTime).getTime()
  if (!Number.isFinite(startMs) || startMs <= Date.now()) {
    return { ok: false as const, error: 'Horário inválido ou no passado' }
  }
  const endIso = new Date(startMs + eventType.duration_minutes * 60_000).toISOString()

  // Re-check the slot wasn't taken between view and submit (race protection).
  const { data: clash } = await admin
    .from('appointments')
    .select('id')
    .eq('organization_id', org.id)
    .neq('status', 'canceled')
    .lt('start_time', endIso)
    .gt('end_time', parsed.data.startTime)
    .limit(1)
    .maybeSingle()

  if (clash) return { ok: false as const, error: 'Horário acabou de ser ocupado — escolha outro' }

  // Find or create lead by email.
  let leadId: string | null = null
  const { data: existing } = await admin
    .from('contatos')
    .select('id')
    .eq('organization_id', org.id)
    .eq('email', parsed.data.guestEmail)
    .maybeSingle()

  if (existing) {
    leadId = existing.id
    await admin
      .from('contatos')
      .update({
        name: parsed.data.guestName,
        phone: parsed.data.guestPhone || undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('id', leadId)
  } else {
    const { data: newLead } = await admin
      .from('contatos')
      .insert({
        organization_id: org.id,
        pipeline_id: eventType.pipeline_id,
        stage_id: eventType.stage_id,
        name: parsed.data.guestName,
        email: parsed.data.guestEmail,
        phone: parsed.data.guestPhone || null,
        source: `agendamento:${eventType.name}`,
      })
      .select('id')
      .maybeSingle()
    if (newLead) leadId = newLead.id
  }

  const { data: appt, error } = await admin
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
    console.error('createPublicAppointment error:', error)
    return { ok: false as const, error: 'Erro ao criar agendamento' }
  }

  if (leadId) {
    await admin.from('contato_activities').insert({
      contato_id: leadId,
      organization_id: org.id,
      type: 'appointment_scheduled',
      payload: {
        appointment_id: appt.id,
        event_type: eventType.name,
        start_time: parsed.data.startTime,
      },
    })
  }

  await inngest.send([
    {
      name: 'appointment.scheduled',
      data: {
        orgId:         org.id,
        appointmentId: appt.id,
        leadId,
        eventTypeId:   eventType.id,
        startTime:     parsed.data.startTime,
      },
    },
    // Fires automation trigger `appointment.booked` so users can build
    // follow-up sequences (email, WhatsApp, move stage…) on new bookings.
    ...(leadId
      ? [{
          name: 'appointment.booked' as const,
          data: {
            orgId:         org.id,
            leadId,
            appointmentId: appt.id,
            eventTypeName: eventType.name,
            startTime:     parsed.data.startTime,
          },
        }]
      : []),
  ])

  return { ok: true as const, appointmentId: appt.id }
}
