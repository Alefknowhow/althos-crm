'use server'

/**
 * Event type CRUD (list/create/update/toggle/delete). Split out of
 * actions/appointments.ts.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization, isImpersonating } from '@/lib/supabase/types'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

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
