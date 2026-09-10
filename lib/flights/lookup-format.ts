

// Nomes comuns (PT/EN) → código IATA, para o vendedor não precisar decorar.
export const AIRLINE_IATA: Record<string, string> = {
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
export function toIata(cia: string): string {
  const c = (cia || '').trim().toUpperCase()
  if (AIRLINE_IATA[c]) return AIRLINE_IATA[c]
  // Já é um código curto (LA, G3, AD…)
  if (/^[A-Z0-9]{2}$/.test(c)) return c
  const first = c.split(/\s+/)[0]
  if (AIRLINE_IATA[first]) return AIRLINE_IATA[first]
  return c.replace(/[^A-Z0-9]/g, '').slice(0, 2)
}


/** "2026-06-15 23:50-03:00" → "15/06 23:50" (hora local do aeroporto). */
export function fmtLocal(local?: string): string {
  if (!local) return ''
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}:\d{2})/)
  if (!m) return ''
  const [, , mm, dd, hhmm] = m
  return `${dd}/${mm} ${hhmm}`
}


/** "2026-06-15 23:50Z" / "...+00:00" → Date (para calcular escalas). */
export function parseUtc(utc?: string): Date | null {
  if (!utc) return null
  // AeroDataBox devolve "2026-06-15 23:50Z" — normaliza p/ ISO.
  const iso = utc.replace(' ', 'T')
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}


/** 150 → "2h 30min"; 45 → "45min". */
export function fmtDuration(min: number): string {
  if (min <= 0) return ''
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h && m) return `${h}h ${m}min`
  if (h) return `${h}h`
  return `${m}min`
}


/** Resolve "LA3302" / "LATAM 3302" → designador, usando defaultCode se faltar cia. */
export function parseSegment(token: string, defaultCode: string): string {
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
