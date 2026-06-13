'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization, isImpersonating } from '@/lib/supabase/types'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { inngest } from '@/lib/inngest/client'
import { runAntispamGauntlet } from '@/lib/security/antispam'

/* -------- Event types CRUD -------- */

export async function listEventTypes(orgSlug: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('event_types')
    .select(
      'id, name, slug, description, duration_minutes, color, location, is_active, buffer_before_minutes, buffer_after_minutes, pipeline_id, stage_id',
    )
    .eq('organization_id', org.id)
    .order('created_at', { ascending: true })
  return data || []
}

const eventTypeInput = z.object({
  name: z.string().min(2),
  duration_minutes: z.coerce.number().int().min(5).max(480),
  description: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  buffer_before_minutes: z.coerce.number().int().min(0).max(120).optional(),
  buffer_after_minutes: z.coerce.number().int().min(0).max(120).optional(),
  pipeline_id: z.string().uuid().nullable().optional(),
  stage_id: z.string().uuid().nullable().optional(),
})

function slugify(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'event'
}

export async function createEventType(orgSlug: string, raw: unknown) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const parsed = eventTypeInput.safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message }

  const baseSlug = slugify(parsed.data.name)
  let slug = baseSlug
  for (let n = 1; n < 1000; n++) {
    const { data } = await supabase
      .from('event_types')
      .select('id')
      .eq('organization_id', org.id)
      .eq('slug', slug)
      .maybeSingle()
    if (!data) break
    slug = `${baseSlug}-${n}`
  }

  const { data, error } = await supabase
    .from('event_types')
    .insert({
      organization_id: org.id,
      name: parsed.data.name,
      slug,
      description: parsed.data.description ?? null,
      duration_minutes: parsed.data.duration_minutes,
      location: parsed.data.location ?? null,
      color: parsed.data.color ?? '#3b82f6',
      buffer_before_minutes: parsed.data.buffer_before_minutes ?? 0,
      buffer_after_minutes: parsed.data.buffer_after_minutes ?? 0,
      pipeline_id: parsed.data.pipeline_id ?? null,
      stage_id: parsed.data.stage_id ?? null,
      is_active: true,
    })
    .select('id')
    .maybeSingle()

  if (error || !data) {
    console.error('createEventType error:', error)
    return { ok: false as const, error: error?.message || 'Erro ao criar' }
  }
  revalidatePath(`/app/${orgSlug}/agendamentos`)
  return { ok: true as const, id: data.id }
}

export async function updateEventType(orgSlug: string, id: string, raw: unknown) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const parsed = eventTypeInput.partial().safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message }

  const { error } = await supabase
    .from('event_types')
    .update(parsed.data)
    .eq('id', id)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/agendamentos`)
  return { ok: true as const }
}

export async function toggleEventTypeActive(orgSlug: string, id: string, isActive: boolean) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { error } = await supabase
    .from('event_types')
    .update({ is_active: isActive })
    .eq('id', id)
    .eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/agendamentos`)
  return { ok: true as const }
}

export async function deleteEventType(orgSlug: string, id: string) {
  if (isImpersonating()) {
    return { ok: false as const, error: 'Ações destrutivas não são permitidas em modo de impersonação.' }
  }
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  // Refuse if there are scheduled future appointments — protects history from
  // CASCADE delete and forces an explicit cleanup step.
  const { count } = await supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('event_type_id', id)
    .eq('status', 'scheduled')
    .gte('start_time', new Date().toISOString())

  if (count && count > 0) {
    return {
      ok: false as const,
      error: `Existem ${count} agendamento(s) futuro(s). Cancele-os antes de excluir o tipo de evento.`,
    }
  }

  const { error } = await supabase
    .from('event_types')
    .delete()
    .eq('id', id)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/agendamentos`)
  return { ok: true as const }
}

/* -------- Availabilities (weekly recurring) -------- */

export async function listAvailabilities(orgSlug: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('availabilities')
    .select('id, day_of_week, start_time, end_time, event_type_id')
    .eq('organization_id', org.id)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true })
  return data || []
}

/**
 * Bulk replace availability windows for the org-wide bucket (event_type_id NULL)
 * or for a specific event type. The full-replace model is the simplest match
 * for a weekly grid editor and avoids tracking per-row IDs in the UI.
 */
export async function setAvailability(
  orgSlug: string,
  windows: Array<{ day_of_week: number; start_time: string; end_time: string }>,
  eventTypeId: string | null = null,
) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  let deleteQ = supabase.from('availabilities').delete().eq('organization_id', org.id)
  deleteQ = eventTypeId
    ? deleteQ.eq('event_type_id', eventTypeId)
    : deleteQ.is('event_type_id', null)
  await deleteQ

  if (windows.length > 0) {
    const { error } = await supabase.from('availabilities').insert(
      windows.map(w => ({
        organization_id: org.id,
        event_type_id: eventTypeId,
        day_of_week: w.day_of_week,
        start_time: w.start_time,
        end_time: w.end_time,
      })),
    )
    if (error) return { ok: false as const, error: error.message }
  }

  revalidatePath(`/app/${orgSlug}/agendamentos`)
  return { ok: true as const }
}

/* -------- Appointments list / cancel / complete -------- */

export async function listAppointments(
  orgSlug: string,
  filter: 'upcoming' | 'past' | 'all' = 'upcoming',
) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  let q = supabase
    .from('appointments')
    .select(
      'id, start_time, end_time, status, guest_name, guest_email, guest_phone, notes, location, canceled_at, canceled_reason, event_type_id, contato_id, event_types(name, color, duration_minutes), leads(id, name)',
    )
    .eq('organization_id', org.id)

  const now = new Date().toISOString()
  if (filter === 'upcoming') q = q.gte('start_time', now).order('start_time', { ascending: true })
  else if (filter === 'past') q = q.lt('start_time', now).order('start_time', { ascending: false })
  else q = q.order('start_time', { ascending: false })

  const { data } = await q.limit(200)
  return data || []
}

export async function cancelAppointment(orgSlug: string, id: string, reason?: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { error } = await supabase
    .from('appointments')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
      canceled_reason: (reason || '').slice(0, 500) || null,
    })
    .eq('id', id)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/agendamentos`)
  return { ok: true as const }
}

export async function markAppointmentCompleted(orgSlug: string, id: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { error } = await supabase
    .from('appointments')
    .update({ status: 'completed' })
    .eq('id', id)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/agendamentos`)
  return { ok: true as const }
}

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
  }

  revalidatePath(`/app/${orgSlug}/agendamentos`)
  return { ok: true as const, appointmentId: appt.id }
}

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
