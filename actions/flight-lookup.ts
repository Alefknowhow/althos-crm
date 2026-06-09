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
  /** Preenchido só na busca em lote: escala até o próximo trecho. */
  connections?: string
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

/** "2026-06-15 23:50Z" / "...+00:00" → Date (para calcular escalas). */
function parseUtc(utc?: string): Date | null {
  if (!utc) return null
  // AeroDataBox devolve "2026-06-15 23:50Z" — normaliza p/ ISO.
  const iso = utc.replace(' ', 'T')
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

/** 150 → "2h 30min"; 45 → "45min". */
function fmtDuration(min: number): string {
  if (min <= 0) return ''
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h && m) return `${h}h ${m}min`
  if (h) return `${h}h`
  return `${m}min`
}

/** Resolve "LA3302" / "LATAM 3302" → designador, usando defaultCode se faltar cia. */
function parseSegment(token: string, defaultCode: string): string {
  const t = (token || '').trim().toUpperCase()
  if (!t) return ''
  // Só dígitos → usa a companhia padrão informada.
  if (/^\d{1,4}$/.test(t)) return defaultCode ? `${defaultCode}${t}` : ''
  // Já vem no formato designador "LA3302".
  if (/^[A-Z0-9]{2}\d{1,4}$/.test(t)) return t
  // "LATAM 3302" / "LATAM3302" → resolve nome + número.
  const numMatch = t.match(/(\d{1,4})\s*$/)
  const num = numMatch ? numMatch[1] : ''
  const ciaPart = t.replace(/\d{1,4}\s*$/, '').trim()
  const code = ciaPart ? toIata(ciaPart) : defaultCode
  return code && num ? `${code}${num}` : ''
}

/**
 * Consulta UM designador (ex.: "LA8084") numa data. Devolve o voo mapeado +
 * os horários UTC crus (para cálculo de escala). Não faz auth — chamadas
 * internas das ações exportadas, que já validaram permissão.
 */
async function fetchOneFlight(
  designator: string,
  date: string,
  key: string,
): Promise<{ ok: true; flight: FlightLookupResult; depUtc: Date | null; arrUtc: Date | null } | { ok: false; error: string }> {
  if (!/^[A-Z0-9]{2}\d{1,4}$/.test(designator)) {
    return { ok: false, error: `Número de voo inválido: "${designator}".` }
  }

  const url =
    `https://${RAPIDAPI_HOST}/flights/number/${encodeURIComponent(designator)}/${date}` +
    `?withAircraftImage=false&withLocation=false`

  let data: any
  try {
    const res = await fetch(url, {
      headers: { 'x-rapidapi-host': RAPIDAPI_HOST, 'x-rapidapi-key': key },
      cache: 'no-store',
    })
    if (res.status === 404) return { ok: false, error: `Voo ${designator} não encontrado para ${date}.` }
    if (res.status === 429) return { ok: false, error: 'Muitas buscas seguidas. Aguarde alguns segundos e tente de novo.' }
    if (!res.ok) return { ok: false, error: `Falha ao consultar ${designator} (HTTP ${res.status}).` }
    data = await res.json()
  } catch {
    return { ok: false, error: 'Não foi possível consultar a malha aérea agora.' }
  }

  if (data && !Array.isArray(data) && data.message) {
    return { ok: false, error: 'Limite da API atingido. Tente novamente em instantes.' }
  }
  const arr: any[] = Array.isArray(data) ? data : []
  if (arr.length === 0) return { ok: false, error: `Voo ${designator} não encontrado para ${date}.` }

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

  return { ok: true, flight, depUtc: parseUtc(dep.scheduledTime?.utc), arrUtc: parseUtc(arr2.scheduledTime?.utc) }
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

  const res = await fetchOneFlight(designator, date, key)
  if (!res.ok) return res
  return { ok: true, flight: res.flight }
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

/**
 * Busca em lote: uma rota com conexões. Recebe vários números de voo (ex.:
 * ["LA3302", "LA8084"]) e uma data; consulta cada perna em sequência (com
 * pausa por causa do rate-limit por segundo) e devolve os trechos já com a
 * escala calculada (aeroporto + tempo de espera) no campo `connections` do
 * trecho que CHEGA na conexão.
 *
 * `defaultAirline` é opcional e se aplica aos números sem prefixo de companhia.
 */
export async function lookupFlightRoute(
  orgSlug: string,
  segments: string[],
  date: string,
  defaultAirline = '',
): Promise<{ ok: true; flights: FlightLookupResult[] } | { ok: false; error: string }> {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'sales')
  if (!perm.allowed) return { ok: false, error: perm.reason }

  const key = process.env.AERODATABOX_KEY
  if (!key) {
    return { ok: false, error: 'Busca de voos não configurada (defina AERODATABOX_KEY no servidor).' }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: 'Data inválida.' }
  }

  const defaultCode = defaultAirline.trim() ? toIata(defaultAirline) : ''
  const designators = segments.map(s => parseSegment(s, defaultCode)).filter(Boolean)
  if (designators.length === 0) {
    return { ok: false, error: 'Informe ao menos um número de voo.' }
  }
  if (designators.length > 4) {
    return { ok: false, error: 'No máximo 4 trechos por busca.' }
  }

  const legs: FlightLookupResult[] = []
  const utcs: { dep: Date | null; arr: Date | null }[] = []
  for (let i = 0; i < designators.length; i++) {
    if (i > 0) await sleep(1100) // respeita o rate-limit por segundo do plano grátis
    const res = await fetchOneFlight(designators[i], date, key)
    if (!res.ok) return { ok: false, error: `${res.error} (trecho ${i + 1})` }
    legs.push(res.flight)
    utcs.push({ dep: res.depUtc, arr: res.arrUtc })
  }

  // Calcula a escala entre trechos consecutivos e anota no trecho que chega.
  for (let i = 0; i < legs.length - 1; i++) {
    const arr = utcs[i].arr
    const nextDep = utcs[i + 1].dep
    const conn = legs[i].destination || legs[i + 1].origin
    if (arr && nextDep) {
      const min = Math.round((nextDep.getTime() - arr.getTime()) / 60000)
      const dur = fmtDuration(min)
      legs[i].connections = conn
        ? `Conexão em ${conn}${dur ? ` · ${dur} de espera` : ''}`
        : (dur ? `${dur} de conexão` : '')
    } else if (conn) {
      legs[i].connections = `Conexão em ${conn}`
    }
  }

  return { ok: true, flights: legs }
}
