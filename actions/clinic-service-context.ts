'use server'

/**
 * Vertical Clínicas — contexto clínico do serviço (event_types) e do
 * agendamento (appointments). Split out of actions/clinic.ts.
 */

import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'

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
