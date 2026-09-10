'use server'

import { toIata, fmtLocal, parseUtc, fmtDuration, parseSegment } from '@/lib/flights/lookup-format'

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
  /** Horário de partida em UTC (ISO) — usado para calcular escala e duração no cliente. */
  departure_utc: string
  /** Horário de chegada em UTC (ISO). */
  arrival_utc: string
  /** Duração do voo em minutos (chegada − partida). */
  duration_min: number
  /** Preenchido só na busca em lote: escala até o próximo trecho. */
  connections?: string
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
  const depUtc = parseUtc(dep.scheduledTime?.utc)
  const arrUtc = parseUtc(arr2.scheduledTime?.utc)
  const duration_min = depUtc && arrUtc
    ? Math.max(0, Math.round((arrUtc.getTime() - depUtc.getTime()) / 60000))
    : 0
  const flight: FlightLookupResult = {
    airline: entry.airline?.name || '',
    flight_number: (entry.number || designator).replace(/\s+/g, ''),
    origin: dep.airport?.iata || '',
    // Preferir a CIDADE (municipalityName) ao nome do aeroporto (shortName).
    origin_name: dep.airport?.municipalityName || dep.airport?.shortName || '',
    origin_terminal: dep.terminal || '',
    destination: arr2.airport?.iata || '',
    destination_name: arr2.airport?.municipalityName || arr2.airport?.shortName || '',
    destination_terminal: arr2.terminal || '',
    departure_at: fmtLocal(dep.scheduledTime?.local),
    arrival_at: fmtLocal(arr2.scheduledTime?.local),
    aircraft: entry.aircraft?.model || '',
    departure_utc: depUtc?.toISOString() || '',
    arrival_utc: arrUtc?.toISOString() || '',
    duration_min,
  }

  return { ok: true, flight, depUtc, arrUtc }
}

export type FlightStatusResult = {
  designator: string
  /** Status normalizado da AeroDataBox — ver mapeamento em fetchFlightStatus. */
  status: 'scheduled' | 'active' | 'landed' | 'cancelled' | 'diverted' | 'unknown'
  scheduled_departure: string | null // ISO UTC
  revised_departure: string | null   // ISO UTC — actualTime ou revisedTime, o que vier
  delay_minutes: number
}

/** AeroDataBox devolve status em inglês livre ("Expected"/"EnRoute"/"Arrived"/
 *  "Canceled"/"Diverted"/"Unknown"...) — normaliza pro enum interno. */
function normalizeStatus(raw: string | undefined): FlightStatusResult['status'] {
  const s = (raw || '').toLowerCase()
  if (s.includes('cancel')) return 'cancelled'
  if (s.includes('divert')) return 'diverted'
  if (s.includes('arriv') || s.includes('land')) return 'landed'
  if (s.includes('en-route') || s.includes('enroute') || s.includes('active') || s.includes('depart')) return 'active'
  if (s.includes('expect') || s.includes('sched')) return 'scheduled'
  return 'unknown'
}

/**
 * Consulta o status ATUAL de um voo (usado pelo cron de embarques, não pela
 * cotação) — mesma chamada de fetchOneFlight, mas lendo os campos de status/
 * horário revisado que a busca de cotação ignora de propósito (lá só importa
 * o horário previsto pra montar o roteiro).
 */
export async function fetchFlightStatus(
  designator: string,
  date: string,
  key: string,
): Promise<{ ok: true; result: FlightStatusResult } | { ok: false; error: string }> {
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
    if (res.status === 429) return { ok: false, error: 'Limite de requisições atingido.' }
    if (!res.ok) return { ok: false, error: `Falha ao consultar ${designator} (HTTP ${res.status}).` }
    data = await res.json()
  } catch {
    return { ok: false, error: 'Não foi possível consultar a malha aérea agora.' }
  }

  if (data && !Array.isArray(data) && data.message) {
    return { ok: false, error: 'Limite da API atingido.' }
  }
  const arr: any[] = Array.isArray(data) ? data : []
  if (arr.length === 0) return { ok: false, error: `Voo ${designator} não encontrado para ${date}.` }

  const entry = arr.find(e => (e?.departure?.scheduledTime?.local || '').startsWith(date)) || arr[0]
  const dep = entry.departure || {}
  const scheduledUtc = parseUtc(dep.scheduledTime?.utc)
  // actualTime só existe depois de decolar; revisedTime é o novo previsto
  // (atraso anunciado antes de decolar) — nessa ordem de preferência.
  const revisedUtc = parseUtc(dep.actualTime?.utc) || parseUtc(dep.revisedTime?.utc)
  const delay_minutes = scheduledUtc && revisedUtc
    ? Math.max(0, Math.round((revisedUtc.getTime() - scheduledUtc.getTime()) / 60000))
    : 0

  return {
    ok: true,
    result: {
      designator,
      status: normalizeStatus(entry.status),
      scheduled_departure: scheduledUtc?.toISOString() || null,
      revised_departure: revisedUtc?.toISOString() || null,
      delay_minutes,
    },
  }
}

/** Monta o designador (ex.: "LA" + "8084" = "LA8084") a partir de companhia
 *  (nome livre ou código) + número — mesma lógica usada por lookupFlight,
 *  extraída pra ser reaproveitada pelo cron de status (actions não podem
 *  importar de outra 'use server' function sem chamada de rede/auth junto). */
export async function buildFlightDesignator(airline: string, number: string): Promise<string | null> {
  const code = toIata(airline)
  const num = (number || '').toUpperCase().replace(/\s+/g, '')
  const designator = num.startsWith(code) ? num : `${code}${num.replace(/[^0-9]/g, '')}`
  return /^[A-Z0-9]{2}\d{1,4}$/.test(designator) ? designator : null
}

export async function lookupFlight(
  orgSlug: string,
  airline: string,
  number: string,
  date: string,
): Promise<{ ok: true; flight: FlightLookupResult } | { ok: false; error: string }> {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'cotacoes')
  if (!perm.allowed) return { ok: false, error: perm.reason }

  const key = process.env.AERODATABOX_KEY
  if (!key) {
    return { ok: false, error: 'Busca de voos não configurada (defina AERODATABOX_KEY no servidor).' }
  }

  // A companhia é opcional: normalmente vem embutida no número (ex.: "LA3302").
  if (!number.trim() || !date.trim()) {
    return { ok: false, error: 'Informe o número do voo (ex.: LA3302) e a data.' }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: 'Data inválida.' }
  }

  const designator = await buildFlightDesignator(airline, number)
  if (!designator) {
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
  const perm = await checkMemberPermission(org.id, user.id, 'cotacoes')
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
