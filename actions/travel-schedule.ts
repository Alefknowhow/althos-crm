'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/supabase/types'
import { buildFlightDesignator } from '@/actions/flight-lookup'

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
  created_by: string | null
  /** Saúde da reserva por tarefas pendentes — ver listScheduledTrips. */
  health: 'green' | 'yellow' | 'red'
  flights: FlightLegInfo[]
}

export type FlightLegInfo = {
  sentido: string | null
  companhia: string | null
  numero_voo: string | null
  origem: string | null
  destino: string | null
  horario: string | null
  data: string | null
  status: 'scheduled' | 'active' | 'landed' | 'cancelled' | 'diverted' | 'unknown' | null
  delay_minutes: number | null
  revised_departure: string | null
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
    .select('id, contato_id, status, client_name, destination, departure_date, return_date, total_cents, hotel_name, airline, operator, package_locator, air_locator, airline_checkin_url, notes, created_by')
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

  const saleIds = rows.map(r => r.id)

  // Saúde da reserva: verde = todas as tarefas concluídas, vermelho = alguma
  // pendente de alta prioridade, amarelo = pendente sem ser alta prioridade.
  const healthBySale = new Map<string, 'green' | 'yellow' | 'red'>()
  if (saleIds.length > 0) {
    const { data: allTasks } = await supabase
      .from('tasks')
      .select('sale_id, status, priority')
      .eq('organization_id', org.id)
      .in('sale_id', saleIds)
    const bySale = new Map<string, { status: string; priority: string | null }[]>()
    for (const t of (allTasks as any[]) ?? []) {
      if (!t.sale_id) continue
      if (!bySale.has(t.sale_id)) bySale.set(t.sale_id, [])
      bySale.get(t.sale_id)!.push({ status: t.status, priority: t.priority })
    }
    Array.from(bySale.entries()).forEach(([saleId, tasks]) => {
      const openTasks = tasks.filter((t: any) => t.status !== 'done')
      if (openTasks.length === 0) healthBySale.set(saleId, 'green')
      else if (openTasks.some((t: any) => t.priority === 'high')) healthBySale.set(saleId, 'red')
      else healthBySale.set(saleId, 'yellow')
    })
  }

  // Voos da reserva (ida/volta): dados factuais vêm direto de sale_products
  // (sempre disponíveis, independente do cron já ter rodado); o status
  // ao vivo (atraso/cancelamento) vem de sale_flight_status quando existir
  // — aqui só lê o que já foi gravado, não chama a AeroDataBox.
  const legsBySale = new Map<string, FlightLegInfo[]>()
  if (saleIds.length > 0) {
    const { data: products } = await supabase
      .from('sale_products')
      .select('sale_id, data')
      .eq('organization_id', org.id)
      .eq('kind', 'aereo')
      .in('sale_id', saleIds)

    type PendingLeg = FlightLegInfo & { sale_id: string; designator: string | null }
    const pending: PendingLeg[] = []
    for (const p of (products as any[]) ?? []) {
      const flightDate = String(p.data?.data || '')
      const designator = /^\d{4}-\d{2}-\d{2}$/.test(flightDate)
        ? await buildFlightDesignator(p.data?.companhia || '', p.data?.numero_voo || '')
        : null
      pending.push({
        sale_id: p.sale_id,
        designator,
        sentido: p.data?.sentido ?? null,
        companhia: p.data?.companhia ?? null,
        numero_voo: p.data?.numero_voo ?? null,
        origem: p.data?.origem ?? null,
        destino: p.data?.destino ?? null,
        horario: p.data?.horario ?? null,
        data: p.data?.data ?? null,
        status: null,
        delay_minutes: null,
        revised_departure: null,
      })
    }

    const designators = Array.from(new Set(pending.map(l => l.designator).filter(Boolean))) as string[]
    if (designators.length > 0) {
      const { data: statuses } = await supabase
        .from('sale_flight_status')
        .select('flight_designator, flight_date, status, delay_minutes, revised_departure')
        .eq('organization_id', org.id)
        .in('flight_designator', designators)
      const statusByKey = new Map((statuses as any[] ?? []).map(s => [`${s.flight_designator}|${s.flight_date}`, s]))

      for (const leg of pending) {
        if (!leg.designator || !leg.data) continue
        const found = statusByKey.get(`${leg.designator}|${leg.data}`)
        if (found) {
          leg.status = found.status
          leg.delay_minutes = found.delay_minutes
          leg.revised_departure = found.revised_departure
        }
      }
    }

    for (const leg of pending) {
      if (!legsBySale.has(leg.sale_id)) legsBySale.set(leg.sale_id, [])
      const { sale_id, designator, ...rest } = leg
      legsBySale.get(sale_id)!.push(rest)
    }
  }

  return rows.map(r => {
    const lead = r.contato_id ? leadById.get(r.contato_id) : null
    return {
      ...r,
      lead_name: lead?.name ?? null,
      lead_phone: lead?.phone ?? null,
      health: healthBySale.get(r.id) ?? 'green',
      flights: legsBySale.get(r.id) ?? [],
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
