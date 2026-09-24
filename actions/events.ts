'use server'

/**
 * Agenda → Eventos (issue #14) — CRUD de Events.
 * Event é um compromisso que ocupa um intervalo de tempo (start_at/end_at),
 * distinto de Task (ação a executar, sem marcar essa agenda) e de
 * appointments (booking público). Tarefas não aparece aqui, Eventos não
 * aparece em Tarefas — bases e UIs isoladas (set/2026). Ver
 * supabase/migrations/0272_agenda_events_and_projetos_generalizados.sql.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { isAccessBlocked } from '@/lib/billing/plans'
import { eventSchema, type EventInput } from '@/lib/validators/event'
import { revalidatePath } from 'next/cache'

const FROZEN_ERROR = 'Conta em modo somente leitura (teste expirado ou assinatura cancelada). Assine um plano para continuar editando.'

export type EventRow = {
  id: string
  organization_id: string
  title: string
  description: string | null
  notes: string | null
  start_at: string
  end_at: string
  all_day: boolean
  organizer_id: string | null
  participant_ids: string[]
  contato_id: string | null
  related_entity_type: string | null
  related_entity_id: string | null
  location: string | null
  event_type: string
  status: 'scheduled' | 'canceled'
  color: string | null
  created_by: string | null
  created_at: string
  contatos?: { id: string; name: string } | null
}

/** Combina data (YYYY-MM-DD) + horário opcional (HH:mm) num ISO em UTC —
 *  mesma âncora usada em TaskDialog.tsx, pra nunca "pular" de dia por fuso. */
function combineDateTime(date: string, time: string | undefined): string {
  return `${date}T${time || '00:00'}:00.000Z`
}

/** Aplica a regra "só um slot de relacionamento por vez" — mesmo princípio
 *  de tasks-crud.ts::relationshipUpdates, sem o slot sale_id (events não
 *  tem coluna dedicada pra reserva, só contato_id/related_entity_*). */
function relationshipUpdates(v: Partial<EventInput>): Record<string, unknown> {
  if (v.contato_id) {
    return { contato_id: v.contato_id, related_entity_type: null, related_entity_id: null }
  }
  if (v.related_entity_type && v.related_entity_id) {
    return { contato_id: null, related_entity_type: v.related_entity_type, related_entity_id: v.related_entity_id }
  }
  return { contato_id: null, related_entity_type: null, related_entity_id: null }
}

function buildTimeRange(v: EventInput) {
  const startAt = combineDateTime(v.start_date, v.all_day ? '00:00' : v.start_time)
  const endDate = v.end_date || v.start_date
  const endAt = v.all_day
    ? combineDateTime(endDate, '23:59')
    : combineDateTime(endDate, v.end_time || v.start_time)
  return { startAt, endAt: endAt < startAt ? startAt : endAt }
}

export async function listEventsForRange(orgSlug: string, range: { from: string; to: string }): Promise<EventRow[]> {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'events')
  if (!check.allowed) throw new Error(check.reason)
  const supabase = createClient()
  const { data, error } = await supabase
    .from('events')
    .select('*, contatos:contato_id(id, name)')
    .eq('organization_id', org.id)
    .lte('start_at', range.to)
    .gte('end_at', range.from)
    .order('start_at', { ascending: true })
  if (error) throw new Error('Não foi possível carregar os eventos')
  return (data as any[]).map(e => ({ ...e, contatos: Array.isArray(e.contatos) ? (e.contatos[0] ?? null) : (e.contatos ?? null) })) as EventRow[]
}

export async function getEvent(orgSlug: string, eventId: string): Promise<EventRow | null> {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'events')
  if (!check.allowed) return null
  const supabase = createClient()
  const { data, error } = await supabase
    .from('events')
    .select('*, contatos:contato_id(id, name)')
    .eq('id', eventId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (error || !data) return null
  const row = data as any
  return { ...row, contatos: Array.isArray(row.contatos) ? (row.contatos[0] ?? null) : (row.contatos ?? null) }
}

export async function createEvent(orgSlug: string, input: EventInput) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  if (isAccessBlocked(org as any)) return { ok: false as const, error: FROZEN_ERROR }
  const check = await checkMemberPermission(org.id, user.id, 'events')
  if (!check.allowed) return { ok: false as const, error: check.reason }
  const supabase = createClient()

  const validation = eventSchema.safeParse(input)
  if (!validation.success) return { ok: false as const, error: validation.error.issues[0].message }
  const v = validation.data
  const { startAt, endAt } = buildTimeRange(v)

  const { data, error } = await supabase.from('events').insert({
    organization_id: org.id,
    title: v.title,
    description: v.description || null,
    notes: v.notes || null,
    start_at: startAt,
    end_at: endAt,
    all_day: v.all_day ?? false,
    event_type: v.event_type || 'presencial',
    location: v.location || null,
    organizer_id: v.organizer_id || user.id,
    participant_ids: v.participant_ids ?? [],
    color: v.color ?? null,
    created_by: user.id,
    ...relationshipUpdates(v),
  }).select('id').single()

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/agenda/eventos`)
  return { ok: true as const, id: data.id as string }
}

export async function updateEvent(orgSlug: string, eventId: string, input: Partial<EventInput>) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  if (isAccessBlocked(org as any)) return { ok: false as const, error: FROZEN_ERROR }
  const check = await checkMemberPermission(org.id, user.id, 'events')
  if (!check.allowed) return { ok: false as const, error: check.reason }
  const supabase = createClient()

  const validation = eventSchema.partial().safeParse(input)
  if (!validation.success) return { ok: false as const, error: validation.error.issues[0].message }
  const v = validation.data

  const updates: Record<string, unknown> = {}
  if (v.title !== undefined) updates.title = v.title
  if (v.description !== undefined) updates.description = v.description || null
  if (v.notes !== undefined) updates.notes = v.notes || null
  if (v.event_type !== undefined) updates.event_type = v.event_type
  if (v.location !== undefined) updates.location = v.location || null
  if (v.organizer_id !== undefined) updates.organizer_id = v.organizer_id || null
  if (v.participant_ids !== undefined) updates.participant_ids = v.participant_ids ?? []
  if (v.color !== undefined) updates.color = v.color ?? null

  if (v.start_date !== undefined) {
    const { startAt, endAt } = buildTimeRange(v as EventInput)
    updates.start_at = startAt
    updates.end_at = endAt
    if (v.all_day !== undefined) updates.all_day = v.all_day
  }

  if (v.contato_id !== undefined || v.related_entity_type !== undefined || v.related_entity_id !== undefined) {
    Object.assign(updates, relationshipUpdates(v))
  }

  if (Object.keys(updates).length === 0) return { ok: true as const }

  const { error } = await supabase.from('events').update(updates).eq('id', eventId).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/agenda/eventos`)
  return { ok: true as const }
}

export async function cancelEvent(orgSlug: string, eventId: string, canceled: boolean) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  if (isAccessBlocked(org as any)) return { ok: false as const, error: FROZEN_ERROR }
  const check = await checkMemberPermission(org.id, user.id, 'events')
  if (!check.allowed) return { ok: false as const, error: check.reason }
  const supabase = createClient()
  const { error } = await supabase.from('events')
    .update({ status: canceled ? 'canceled' : 'scheduled' })
    .eq('id', eventId).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/agenda/eventos`)
  return { ok: true as const }
}

export async function deleteEvent(orgSlug: string, eventId: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  if (isAccessBlocked(org as any)) return { ok: false as const, error: FROZEN_ERROR }
  const check = await checkMemberPermission(org.id, user.id, 'events')
  if (!check.allowed) return { ok: false as const, error: check.reason }
  const supabase = createClient()
  const { error } = await supabase.from('events').delete().eq('id', eventId).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/agenda/eventos`)
  return { ok: true as const }
}
