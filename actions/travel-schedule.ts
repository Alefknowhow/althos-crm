'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/supabase/types'
import { buildFlightDesignator } from '@/actions/flight-lookup'
import { AIRPORTS } from '@/lib/airports'
import { flagForCountry } from '@/lib/travel/country-flag'

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
  /** Tarefas concluídas / total vinculadas à reserva — coluna Tarefas do
   *  painel de Gestão de Viagens (mesmas tarefas do módulo Tarefas). */
  tasks_done: number
  tasks_total: number
  /** Bandeira do destino (emoji) — deduzida do aeroporto de chegada do 1º
   *  trecho de ida via lib/airports.ts, quando disponível. */
  destination_flag: string | null
  /** País do destino (deduzido do aeroporto de chegada), pra mostrar abaixo
   *  do nome da cidade na coluna Datas/Destino — 'Brasil' quando o aeroporto
   *  é doméstico (sem `country` em AIRPORTS). */
  destination_country: string | null
  flights: FlightLegInfo[]
  /** Itens inclusos na reserva (voos/hospedagem/transfer/passeios/...) —
   *  mesmas chaves de INCLUDED_ITEMS (proposals/TravelSalesViewShared.tsx),
   *  usado pra montar os mini-cards de resumo do painel de embarques. */
  included_items: string[]
  /** Demais produtos contratados (tudo que não é voo) — versão resumida
   *  (só kind + título), pra mostrar um card simples por item na linha
   *  abaixo do itinerário no painel de Embarques. */
  other_items: OtherProductSummary[]
}

export type FlightLegInfo = {
  /** id da linha em sale_products. */
  id: string
  sentido: string | null
  companhia: string | null
  numero_voo: string | null
  origem: string | null
  destino: string | null
  horario: string | null
  data: string | null
  /** Data/horário de chegada — campos "Data de chegada"/"Hora de chegada"
   *  do formulário de Reservas › Produtos (aéreo). */
  data_chegada: string | null
  horario_chegada: string | null
  /** Conexão ANTES deste trecho — aeroporto/cidade de escala + tempo de
   *  espera. Campos "Conexão — aeroporto/cidade" e "Conexão — tempo de
   *  espera" do formulário de Reservas › Produtos (aéreo), ou os
   *  equivalentes escala_local/escala_duracao quando o voo tem vários
   *  trechos extraídos de um voucher (data.legs). */
  conexao_local: string | null
  conexao_duracao: string | null
  status: 'scheduled' | 'active' | 'landed' | 'cancelled' | 'diverted' | 'unknown' | null
  delay_minutes: number | null
  revised_departure: string | null
}

export type OtherProductSummary = { id: string; kind: string; title: string; subtitle: string | null }

/** Resumo de "demais itens contratados" pro painel de Embarques — mesma
 *  lógica de título/subtítulo do SaleProductCard (Reservas › Produtos),
 *  só que compacto (1 linha) em vez do card completo. */
function otherProductSummary(kind: string, data: Record<string, any>): { title: string; subtitle: string | null } {
  switch (kind) {
    case 'hospedagem':
      return {
        title: data.hotel || 'Hospedagem',
        subtitle: [data.tipo_quarto, data.regime].filter(Boolean).join(' · ') || null,
      }
    case 'transfer':
      return { title: data.fornecedor || 'Transfer', subtitle: [data.origem, data.destino].filter(Boolean).join(' → ') || null }
    case 'cruzeiro':
      return { title: data.navio || data.companhia || 'Cruzeiro', subtitle: data.roteiro || null }
    case 'ingresso':
      return { title: data.atracao || data.nome || 'Ingresso', subtitle: data.fornecedor || null }
    case 'seguro':
      return { title: data.nome || data.fornecedor || 'Seguro viagem', subtitle: null }
    case 'veiculo':
      return { title: data.fornecedor || data.nome || 'Locação de veículo', subtitle: [data.categoria, data.modelo].filter(Boolean).join(' · ') || null }
    default:
      return { title: data.nome || data.fornecedor || 'Item', subtitle: null }
  }
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
    .select('id, contato_id, status, client_name, destination, departure_date, return_date, total_cents, hotel_name, airline, operator, package_locator, air_locator, airline_checkin_url, notes, created_by, included_items')
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
  const taskCountsBySale = new Map<string, { done: number; total: number }>()
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
      taskCountsBySale.set(saleId, { done: tasks.length - openTasks.length, total: tasks.length })
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
      .select('id, sale_id, data')
      .eq('organization_id', org.id)
      .eq('kind', 'aereo')
      .in('sale_id', saleIds)

    type PendingLeg = FlightLegInfo & { sale_id: string; designator: string | null }
    const pending: PendingLeg[] = []
    for (const p of (products as any[]) ?? []) {
      // Um produto 'aereo' pode ser um trecho único (campos direto em
      // `data`, com uma conexão opcional em `conexao_local`/`conexao_duracao`)
      // ou vários trechos extraídos de um voucher (`data.legs[]`, cada um
      // com sua própria escala_local/escala_duracao — a espera ANTES dele).
      const multiLeg = Array.isArray(p.data?.legs) && p.data.legs.length > 0
      const rawLegs = multiLeg
        ? p.data.legs.map((l: any) => ({
            companhia: l.companhia ?? p.data?.companhia ?? null,
            numero_voo: l.numero ?? null,
            origem: l.origem ?? null,
            destino: l.destino ?? null,
            horario: l.hora_embarque ?? null,
            data: p.data?.data ?? null,
            data_chegada: p.data?.data_chegada ?? null,
            horario_chegada: l.hora_chegada ?? null,
            conexao_local: l.escala_local ?? null,
            conexao_duracao: l.escala_duracao ?? null,
          }))
        : [{
            companhia: p.data?.companhia ?? null,
            numero_voo: p.data?.numero_voo ?? null,
            origem: p.data?.origem ?? null,
            destino: p.data?.destino ?? null,
            // 'horario' e 'hora_embarque' são 2 campos distintos no
            // formulário de Reservas › Produtos (aéreo) — a extração por
            // IA e o preenchimento manual nem sempre passam pelos dois,
            // então usa o que estiver preenchido, sem prender numa chave só.
            horario: p.data?.horario || p.data?.hora_embarque || null,
            data: p.data?.data ?? null,
            data_chegada: p.data?.data_chegada ?? null,
            horario_chegada: p.data?.hora_chegada ?? null,
            conexao_local: p.data?.conexao_local ?? null,
            conexao_duracao: p.data?.conexao_duracao ?? null,
          }]

      for (let i = 0; i < rawLegs.length; i++) {
        const raw = rawLegs[i]
        const flightDate = String(raw.data || '')
        const designator = /^\d{4}-\d{2}-\d{2}$/.test(flightDate)
          ? await buildFlightDesignator(raw.companhia || '', raw.numero_voo || '')
          : null
        pending.push({
          id: multiLeg ? `${p.id}-${i}` : p.id,
          sale_id: p.sale_id,
          designator,
          sentido: p.data?.sentido ?? null,
          ...raw,
          status: null,
          delay_minutes: null,
          revised_departure: null,
        })
      }
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
      const { sale_id, designator: _designator, ...rest } = leg
      legsBySale.get(sale_id)!.push(rest)
    }
  }

  // Demais produtos contratados (tudo que não é 'aereo') — resumo simples
  // (kind + título) pra exibir como card na linha abaixo do itinerário.
  const otherBySale = new Map<string, OtherProductSummary[]>()
  if (saleIds.length > 0) {
    const { data: otherProducts } = await supabase
      .from('sale_products')
      .select('id, sale_id, kind, data')
      .eq('organization_id', org.id)
      .neq('kind', 'aereo')
      .in('sale_id', saleIds)
    for (const p of (otherProducts as any[]) ?? []) {
      if (!otherBySale.has(p.sale_id)) otherBySale.set(p.sale_id, [])
      const { title, subtitle } = otherProductSummary(p.kind, p.data || {})
      otherBySale.get(p.sale_id)!.push({ id: p.id, kind: p.kind, title, subtitle })
    }
  }

  return rows.map(r => {
    const lead = r.contato_id ? leadById.get(r.contato_id) : null
    const flights = legsBySale.get(r.id) ?? []
    const outbound = flights.find(f => f.sentido !== 'volta') ?? flights[0]
    const airport = outbound?.destino ? AIRPORTS[outbound.destino.toUpperCase()] : null
    const counts = taskCountsBySale.get(r.id)
    return {
      ...r,
      lead_name: lead?.name ?? null,
      lead_phone: lead?.phone ?? null,
      health: healthBySale.get(r.id) ?? 'green',
      tasks_done: counts?.done ?? 0,
      tasks_total: counts?.total ?? 0,
      destination_flag: flagForCountry(airport?.country) || (airport && !airport.country ? '🇧🇷' : null),
      destination_country: airport ? (airport.country ?? 'Brasil') : null,
      flights,
      included_items: Array.isArray(r.included_items) ? r.included_items : [],
      other_items: otherBySale.get(r.id) ?? [],
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
