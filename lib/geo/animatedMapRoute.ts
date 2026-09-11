/**
 * Resolução de rota do Mapa animado (Cotações) — separada de
 * `AnimatedMapBlockInner.tsx` de propósito: esse arquivo não importa
 * d3-geo/topojson-client/world-atlas (pesado, client-only), então pode ser
 * usado em qualquer lugar que só precise saber "essa rota é animável?" sem
 * puxar o bundle do mapa em si (ex.: decidir se mostra a abertura animada
 * antes mesmo de o bloco pesado carregar).
 */

import { resolveCountry } from './countries'
import { CITIES_BY_ISO2 } from './cities'

export type AnimatedMapPoint = { country: string; city?: string | null }
export type AnimatedMapRoute = { origin: AnimatedMapPoint; stops: AnimatedMapPoint[] }
export type ResolvedWaypoint = { label: string; lat: number; lng: number; iso2: string; enName?: string }

export function resolveWaypoint(point: AnimatedMapPoint): ResolvedWaypoint | null {
  const info = resolveCountry(point.country)
  if (!info) return null
  const cityName = point.city?.trim()
  const cityMatch = cityName
    ? CITIES_BY_ISO2[info.iso2]?.find(c => c.name.toLowerCase() === cityName.toLowerCase())
    : null
  return {
    label: cityName ? `${cityName}, ${info.name}` : info.name,
    lat: cityMatch?.lat ?? info.lat,
    lng: cityMatch?.lng ?? info.lng,
    iso2: info.iso2,
    enName: info.enName,
  }
}

export function resolveRoute(route: AnimatedMapRoute | null | undefined): ResolvedWaypoint[] {
  if (!route?.origin?.country) return []
  return [route.origin, ...(route.stops || [])]
    .map(resolveWaypoint)
    .filter((w): w is ResolvedWaypoint => !!w)
}

/** Precisa de origem + ao menos 1 parada reconhecida pra valer a pena animar. */
export function hasAnimatableRoute(route: AnimatedMapRoute | null | undefined): boolean {
  return resolveRoute(route).length >= 2
}
