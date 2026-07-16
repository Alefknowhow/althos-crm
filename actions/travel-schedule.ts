'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/supabase/types'

export type ScheduledTrip = {
  id: string
  contato_id: string | null
  status: string
  client_name: string | null
  destination: string | null
  departure_date: string | null
  return_date: string | null
  total_cents: number
  hotel_name: string | null
  airline: string | null
  operator: string | null
  package_locator: string | null
  air_locator: string | null
  airline_checkin_url: string | null
  notes: string | null
  lead_name: string | null
  lead_phone: string | null
}

export type TripTask = {
  id: string
  title: string | null
  status: string
  priority: string | null
  due_date: string | null
}

/**
 * Viagens vendidas com data de partida definida, enriquecidas com o telefone
 * do lead (para o atalho de WhatsApp). Base do painel "Viagens Programadas".
 */
export async function listScheduledTrips(orgSlug: string): Promise<ScheduledTrip[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data: sales } = await supabase
    .from('travel_sales')
    .select('id, contato_id, status, client_name, destination, departure_date, return_date, total_cents, hotel_name, airline, operator, package_locator, air_locator, airline_checkin_url, notes')
    .eq('organization_id', org.id)
    .not('departure_date', 'is', null)
    .order('departure_date', { ascending: true })
    .limit(500)

  const rows = (sales as any[]) ?? []
  const leadIds = Array.from(new Set(rows.map(r => r.contato_id).filter(Boolean)))

  const leadById = new Map<string, { name: string | null; phone: string | null }>()
  if (leadIds.length > 0) {
    const { data: leads } = await supabase
      .from('contatos')
      .select('id, name, phone')
      .eq('organization_id', org.id)
      .in('id', leadIds)
    for (const l of (leads as any[]) ?? []) {
      leadById.set(l.id, { name: l.name ?? null, phone: l.phone ?? null })
    }
  }

  return rows.map(r => {
    const lead = r.contato_id ? leadById.get(r.contato_id) : null
    return {
      ...r,
      lead_name: lead?.name ?? null,
      lead_phone: lead?.phone ?? null,
    } as ScheduledTrip
  })
}

/** Tarefas operacionais vinculadas ao lead da viagem. */
export async function getTripTasks(orgSlug: string, leadId: string): Promise<TripTask[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('tasks')
    .select('id, title, status, priority, due_date')
    .eq('organization_id', org.id)
    .eq('contato_id', leadId)
    .order('due_date', { ascending: true })
    .limit(200)
  return (data as TripTask[]) ?? []
}
