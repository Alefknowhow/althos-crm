/**
 * Cálculo de datas de recorrência e parcelamento — puro (sem I/O), usado
 * tanto pelo servidor (geração real dos lançamentos em actions/financial.ts)
 * quanto pelo client (prévia das próximas datas antes de salvar).
 */

export type RecurrenceFrequency =
  | 'semanal' | 'quinzenal' | 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual'

export const FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  semanal: 'Semanal', quinzenal: 'Quinzenal', mensal: 'Mensal', bimestral: 'Bimestral',
  trimestral: 'Trimestral', semestral: 'Semestral', anual: 'Anual',
}

/** Dias de intervalo por frequência — para semanal/quinzenal (não têm o
 *  problema de "clamp de dia do mês" que mensal/bimestral/etc têm). */
const FREQUENCY_DAYS: Partial<Record<RecurrenceFrequency, number>> = {
  semanal: 7, quinzenal: 14,
}

/** Meses de intervalo por frequência mensal e múltiplos. */
const FREQUENCY_MONTHS: Partial<Record<RecurrenceFrequency, number>> = {
  mensal: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12,
}

/** Soma N meses a uma data ISO (YYYY-MM-DD), clampando ao último dia do mês
 *  de destino (ex.: 31/01 + 1 mês vira 28/02 ou 29/02). */
export function addMonthsIso(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1 + months, 1))
  const lastDay = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate()
  dt.setUTCDate(Math.min(d, lastDay))
  return dt.toISOString().slice(0, 10)
}

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return dt.toISOString().slice(0, 10)
}

/** Avança `iso` em N períodos da frequência dada. */
export function addByFrequency(iso: string, frequency: RecurrenceFrequency, periods: number): string {
  const days = FREQUENCY_DAYS[frequency]
  if (days) return addDaysIso(iso, days * periods)
  const months = FREQUENCY_MONTHS[frequency]!
  return addMonthsIso(iso, months * periods)
}

/** Trava de segurança — nunca gera mais que isso numa tacada só, mesmo com
 *  "infinita" ou N absurdo (evita travar o banco/UI com milhares de linhas). */
export const MAX_GENERATED_OCCURRENCES = 60

export type RecurrenceOptions = {
  frequency: RecurrenceFrequency
  count?: number | null
  until?: string | null
  infinite?: boolean
}

/**
 * Datas das ocorrências FUTURAS (não inclui a data inicial) a partir de
 * `startIso`, respeitando count (nº de repetições), until (data-limite) ou
 * infinite (gera até MAX_GENERATED_OCCURRENCES e caberá a um job futuro
 * estender a janela — não implementado nesta leva).
 */
export function computeRecurrenceDates(startIso: string, opts: RecurrenceOptions): string[] {
  const dates: string[] = []
  const limit = opts.infinite
    ? MAX_GENERATED_OCCURRENCES
    : Math.min(Math.max(opts.count ?? 0, 0), MAX_GENERATED_OCCURRENCES)

  for (let i = 1; i <= limit; i++) {
    const next = addByFrequency(startIso, opts.frequency, i)
    if (opts.until && !opts.infinite && next > opts.until) break
    dates.push(next)
    if (opts.until && opts.infinite && next > opts.until) break
  }
  return dates
}

/** Datas das parcelas FUTURAS (parcela 2..N) a partir da data da 1ª parcela,
 *  com intervalo em dias (30 = "mensal" aproximado, mas configurável — cartão
 *  de crédito nem sempre cai no mesmo dia todo mês). */
export function computeInstallmentDates(firstDateIso: string, totalInstallments: number, intervalDays: number): string[] {
  const n = Math.min(Math.max(totalInstallments - 1, 0), MAX_GENERATED_OCCURRENCES)
  const dates: string[] = []
  for (let i = 1; i <= n; i++) dates.push(addDaysIso(firstDateIso, intervalDays * i))
  return dates
}
