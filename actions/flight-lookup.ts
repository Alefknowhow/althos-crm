'use server'

import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'

/**
 * Preenchimento automático de voo (AeroDataBox via RapidAPI).
 *
 * O vendedor informa apenas Companhia + Número + Data; consultamos a malha
 * aérea e devolvemos os campos factuais já formatados (origem, destino,
 * horários, aeronave, terminais). Texto livre (bagagem, conexões, políticas)
 * continua manual — a API não fornece e o LLM alucinaria.
 *
 * Requer a env AERODATABOX_KEY (chave do RapidAPI). Sem ela, retorna erro
 * amigável em vez de quebrar.
 */

const RAPIDAPI_HOST = 'aerodatabox.p.rapidapi.com'

export type FlightLookupResult = {
  airline: string
  flight_number: string
  origin: string
  origin_name: string
  origin_terminal: string
  destination: string
  destination_name: string
  destination_terminal: string
  departure_at: string
  arrival_at: string
  aircraft: string
}

// Nomes comuns (PT/EN) → código IATA, para o vendedor não precisar decorar.
const AIRLINE_IATA: Record<string, string> = {
  LATAM: 'LA', TAM: 'LA', GOL: 'G3', AZUL: 'AD', AVIANCA: 'AV',
  TAP: 'TP', 'TAP PORTUGAL': 'TP', AMERICAN: 'AA', 'AMERICAN AIRLINES': 'AA',
  UNITED: 'UA', 'UNITED AIRLINES': 'UA', DELTA: 'DL', IBERIA: 'IB',
  'AIR FRANCE': 'AF', KLM: 'KL', LUFTHANSA: 'LH', EMIRATES: 'EK',
  QATAR: 'QR', 'QATAR AIRWAYS': 'QR', COPA: 'CM', 'COPA AIRLINES': 'CM',
  'AEROLINEAS ARGENTINAS': 'AR', AEROMEXICO: 'AM', 'BRITISH AIRWAYS': 'BA',
  'AIR CANADA': 'AC', TURKISH: 'TK', 'TURKISH AIRLINES': 'TK',
  ITA: 'AZ', ALITALIA: 'AZ', SWISS: 'LX', AZORES: 'S4', 'AIR EUROPA': 'UX',
}

/** Resolve a "Cia" digitada para o código IATA de 2 caracteres. */
function toIata(cia: string): string {
  const c = (cia || '').trim().toUpperCase()
  if (AIRLINE_IATA[c]) return AIRLINE_IATA[c]
  // Já é um código curto (LA, G3, AD…)
  if (/^[A-Z0-9]{2}$/.test(c)) return c
  const first = c.split(/\s+/)[0]
  if (AIRLINE_IATA[first]) return AIRLINE_IATA[first]
  return c.replace(/[^A-Z0-9]/g, '').slice(0, 2)
}

/** "2026-06-15 23:50-03:00" → "15/06 23:50" (hora local do aeroporto). */
function fmtLocal(local?: string): string {
  if (!local) return ''
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}:\d{2})/)
  if (!m) return ''
  const [, , mm, dd, hhmm] = m
  return `${dd}/${mm} ${hhmm}`
}

export async function lookupFlight(
  orgSlug: string,
  airline: string,
  number: string,
  date: string,
): Promise<{ ok: true; flight: FlightLookupResult } | { ok: false; error: string }> {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'sales')
  if (!perm.allowed) return { ok: false, error: perm.reason }

  const key = process.env.AERODATABOX_KEY
  if (!key) {
    return { ok: false, error: 'Busca de voos não configurada (defina AERODATABOX_KEY no servidor).' }
  }

  if (!airline.trim() || !number.trim() || !date.trim()) {
    return { ok: false, error: 'Informe companhia, número do voo e data.' }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: 'Data inválida.' }
  }

  // Monta o designador (ex.: "LA" + "8084" = "LA8084").
  const code = toIata(airline)
  const num = (number || '').toUpperCase().replace(/\s+/g, '')
  const designator = num.startsWith(code) ? num : `${code}${num.replace(/[^0-9]/g, '')}`

  if (!/^[A-Z0-9]{2}\d{1,4}$/.test(designator)) {
    return { ok: false, error: 'Não consegui montar o número do voo. Confira a companhia e o número.' }
  }

  const url =
    `https://${RAPIDAPI_HOST}/flights/number/${encodeURIComponent(designator)}/${date}` +
    `?withAircraftImage=false&withLocation=false`

  let data: any
  try {
    const res = await fetch(url, {
      headers: { 'x-rapidapi-host': RAPIDAPI_HOST, 'x-rapidapi-key': key },
      // Não cachear: voos podem ter ajuste de horário.
      cache: 'no-store',
    })
    if (res.status === 404) {
      return { ok: false, error: `Voo ${designator} não encontrado para ${date}.` }
    }
    if (res.status === 429) {
      return { ok: false, error: 'Muitas buscas seguidas. Aguarde alguns segundos e tente de novo.' }
    }
    if (!res.ok) {
      return { ok: false, error: `Falha ao consultar o voo (HTTP ${res.status}).` }
    }
    data = await res.json()
  } catch {
    return { ok: false, error: 'Não foi possível consultar a malha aérea agora.' }
  }

  // A API pode devolver mensagem de erro como objeto, ou um array de voos.
  if (data && !Array.isArray(data) && data.message) {
    return { ok: false, error: 'Limite da API atingido. Tente novamente em instantes.' }
  }
  const arr: any[] = Array.isArray(data) ? data : []
  if (arr.length === 0) {
    return { ok: false, error: `Voo ${designator} não encontrado para ${date}.` }
  }

  // Prefere a ocorrência cuja partida (hora local) cai na data pedida.
  const entry = arr.find(e => (e?.departure?.scheduledTime?.local || '').startsWith(date)) || arr[0]

  const dep = entry.departure || {}
  const arr2 = entry.arrival || {}
  const flight: FlightLookupResult = {
    airline: entry.airline?.name || '',
    flight_number: (entry.number || designator).replace(/\s+/g, ''),
    origin: dep.airport?.iata || '',
    origin_name: dep.airport?.shortName || dep.airport?.municipalityName || '',
    origin_terminal: dep.terminal || '',
    destination: arr2.airport?.iata || '',
    destination_name: arr2.airport?.shortName || arr2.airport?.municipalityName || '',
    destination_terminal: arr2.terminal || '',
    departure_at: fmtLocal(dep.scheduledTime?.local),
    arrival_at: fmtLocal(arr2.scheduledTime?.local),
    aircraft: entry.aircraft?.model || '',
  }

  return { ok: true, flight }
}
