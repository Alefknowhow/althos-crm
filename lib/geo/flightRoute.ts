/**
 * Resolução do Mapa de rota de voos (Cotações → aba Voos) — deriva pernas
 * plotáveis (com coordenada) e o agrupamento ida/volta a partir dos voos já
 * cadastrados no editor (`from_code`/`to_code`/`leg_type`), sem exigir
 * nenhuma configuração manual extra. Não importa nada pesado (d3-geo etc.)
 * de propósito — só precisa saber "dá pra desenhar o mapa?" em contextos
 * onde o bundle pesado ainda não deve carregar.
 */

import { airportFromCode } from '@/lib/airports'
import { resolveCountry, type CountryInfo } from './countries'

export type FlightLegInput = {
  leg_type?: string | null
  from_code?: string | null
  to_code?: string | null
  /** Sigla do aeroporto de conexão (opcional) — quando reconhecida, a
   *  perna vira dois trechos (origem→conexão, conexão→destino) pro mapa
   *  marcar o ponto de escala em vez de uma linha reta direto pro destino. */
  stopover_code?: string | null
}

export type RouteGroup = 'outbound' | 'inbound'

export const GROUP_COLORS: Record<RouteGroup, string> = { outbound: '#1a73e8', inbound: '#ea4335' }
export const GROUP_LABELS: Record<RouteGroup, string> = { outbound: 'Ida', inbound: 'Volta' }

export type ResolvedLegPoint = { code: string; lat: number; lng: number; country: CountryInfo | null }
export type ResolvedLeg = { from: ResolvedLegPoint; to: ResolvedLegPoint; group: RouteGroup; isConnection?: boolean }

function toPoint(code: string | null | undefined): ResolvedLegPoint | null {
  const airport = airportFromCode(code)
  if (!airport) return null
  return { code: (code || '').trim().toUpperCase(), lat: airport.lat, lng: airport.lng, country: airport.country ? resolveCountry(airport.country) : null }
}

/**
 * Pernas com coordenada conhecida, na ordem em que foram cadastradas —
 * pernas com sigla não reconhecida na base de aeroportos são descartadas
 * (não têm como plotar). Conexões (`leg_type: 'connection'`) herdam o
 * grupo (ida/volta) da perna anterior mais próxima; se a primeira perna já
 * vier como conexão (ordem incomum), assume "ida". Uma escala registrada
 * (`stopover_code` reconhecido) quebra a perna em dois trechos, marcando o
 * ponto de conexão no mapa em vez de traçar reto até o destino.
 */
export function resolveFlightLegs(flights: FlightLegInput[]): ResolvedLeg[] {
  const legs: ResolvedLeg[] = []
  let currentGroup: RouteGroup = 'outbound'
  for (const f of flights) {
    if (f.leg_type === 'outbound' || f.leg_type === 'inbound') currentGroup = f.leg_type
    const from = toPoint(f.from_code)
    const to = toPoint(f.to_code)
    if (!from || !to) continue
    const stopover = toPoint(f.stopover_code)
    if (stopover) {
      legs.push({ from, to: stopover, group: currentGroup, isConnection: true })
      legs.push({ from: stopover, to, group: currentGroup, isConnection: true })
    } else {
      legs.push({ from, to, group: currentGroup })
    }
  }
  return legs
}

export function hasFlightRouteMap(flights: FlightLegInput[]): boolean {
  return resolveFlightLegs(flights).length > 0
}
