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

export type FlightLegInput = { leg_type?: string | null; from_code?: string | null; to_code?: string | null }

export type RouteGroup = 'outbound' | 'inbound'

export const GROUP_COLORS: Record<RouteGroup, string> = { outbound: '#3fa9f5', inbound: '#f5a83f' }
export const GROUP_LABELS: Record<RouteGroup, string> = { outbound: 'Ida', inbound: 'Volta' }

export type ResolvedLegPoint = { code: string; lat: number; lng: number; country: CountryInfo | null }
export type ResolvedLeg = { from: ResolvedLegPoint; to: ResolvedLegPoint; group: RouteGroup }

/**
 * Pernas com coordenada conhecida, na ordem em que foram cadastradas —
 * pernas com sigla não reconhecida na base de aeroportos são descartadas
 * (não têm como plotar). Conexões (`leg_type: 'connection'`) herdam o
 * grupo (ida/volta) da perna anterior mais próxima; se a primeira perna já
 * vier como conexão (ordem incomum), assume "ida".
 */
export function resolveFlightLegs(flights: FlightLegInput[]): ResolvedLeg[] {
  const legs: ResolvedLeg[] = []
  let currentGroup: RouteGroup = 'outbound'
  for (const f of flights) {
    if (f.leg_type === 'outbound' || f.leg_type === 'inbound') currentGroup = f.leg_type
    const from = airportFromCode(f.from_code)
    const to = airportFromCode(f.to_code)
    if (!from || !to) continue
    legs.push({
      from: { code: (f.from_code || '').trim().toUpperCase(), lat: from.lat, lng: from.lng, country: from.country ? resolveCountry(from.country) : null },
      to: { code: (f.to_code || '').trim().toUpperCase(), lat: to.lat, lng: to.lng, country: to.country ? resolveCountry(to.country) : null },
      group: currentGroup,
    })
  }
  return legs
}

/** Países estrangeiros (não-Brasil) presentes nas pernas — únicos, prontos
 *  pra pintar no mapa. Aeroportos brasileiros nunca entram aqui (não têm
 *  `country` cadastrado em `lib/airports.ts`). */
export function foreignCountriesInLegs(legs: ResolvedLeg[]): CountryInfo[] {
  const byIso2 = new Map<string, CountryInfo>()
  for (const leg of legs) {
    if (leg.from.country) byIso2.set(leg.from.country.iso2, leg.from.country)
    if (leg.to.country) byIso2.set(leg.to.country.iso2, leg.to.country)
  }
  return Array.from(byIso2.values())
}

export function hasFlightRouteMap(flights: FlightLegInput[]): boolean {
  return resolveFlightLegs(flights).length > 0
}
