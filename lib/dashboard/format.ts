/**
 * Formatadores compartilhados do Dashboard (antes duplicados em cada aba).
 * Funções puras — seguras em Server e Client Components.
 */

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const BRL_0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const COMPACT = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })

/** Centavos → "R$ 1.234,56". */
export function fmtCurrency(cents: number | null | undefined): string {
  return BRL.format((cents || 0) / 100)
}

/** Centavos → "R$ 1.235" (sem casas decimais — cards e listas densas). */
export function fmtCurrency0(cents: number | null | undefined): string {
  return BRL_0.format((cents || 0) / 100)
}

/** Centavos → "R$ 187,4 mil" (eixos, rótulos curtos). */
export function fmtCurrencyCompact(cents: number | null | undefined): string {
  return `R$ ${COMPACT.format((cents || 0) / 100)}`
}

/** Centavos → "187,4 mil" (tick de eixo, sem prefixo). */
export function fmtAxisCompact(cents: number | null | undefined): string {
  return COMPACT.format((cents || 0) / 100)
}

export function fmtPct(pct: number | null | undefined, digits = 0): string {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return '—'
  return `${pct.toFixed(digits).replace('.', ',')}%`
}

export function fmtDays(days: number | null | undefined): string {
  if (days === null || days === undefined || !Number.isFinite(days)) return '—'
  if (days < 10) return `${days.toFixed(1).replace('.', ',')} ${days === 1 ? 'dia' : 'dias'}`
  return `${Math.round(days)} dias`
}

export function fmtMinutes(min: number | null | undefined): string {
  if (min === null || min === undefined) return '—'
  if (min < 60) return `${Math.round(min)} min`
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

/** "2026-03" → "Mar/26". */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, (m || 1) - 1, 1)
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(d).replace('.', '')
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}/${String(y).slice(2)}`
}

/** Últimos N meses (inclui o corrente), em ordem cronológica, "YYYY-MM". */
export function lastNMonths(n: number, ref = new Date()): string[] {
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1)
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}
