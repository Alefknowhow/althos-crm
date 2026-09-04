'use server'

/**
 * Weekly recurring availability + appointment list/cancel/complete.
 * Split out of actions/appointments.ts.
 */

import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'

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
      'id, start_time, end_time, status, guest_name, guest_email, guest_phone, notes, location, canceled_at, canceled_reason, event_type_id, contato_id, event_types(name, color, duration_minutes), leads:contatos(id, name)',
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
