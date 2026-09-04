/**
 * Header detection + row parsing for CsvImporter. Split out of
 * CsvImporter.tsx — pure functions, no React.
 */

import { detectColumn, parseDate, parseMoney, parseCsv } from '@/lib/csv'

export type ParsedRow = {
  rowNum: number
  campaign_name: string
  date: string
  spend_cents: number
  impressions: number
  clicks: number
  matched: boolean
  campaign_id?: string
  warning?: string
}

/**
 * Header detection — keys we accept (case-insensitive, with diacritic stripping).
 * Meta and Google Ads exports vary, so we maintain a per-field synonym list.
 */
// All synonyms are matched after lowercasing + diacritic stripping, so we
// write them without accents on the Portuguese side.
const HEADER_SYNONYMS = {
  campaign: [
    'campaign name',
    'campaign',
    'campanha',
    'nome da campanha',
  ],
  // Daily date column. With "Por dia" enabled, Meta BR exports each day as a
  // row where "Início dos relatórios" == "Encerramento dos relatórios" — so
  // we accept the start-of-report column as the per-row date. Without "Por
  // dia" the user gets a single row spanning the whole period; we detect
  // that mistake during row parsing and warn.
  date: [
    'day',
    'date',
    'data',
    'dia',
    'reporting starts', // Meta English
    'inicio dos relatorios', // Meta BR (after diacritic strip)
    'início dos relatórios',
    'data do relatorio',
    'data do relatório',
  ],
  spend: [
    'amount spent (brl)',
    'amount spent',
    'amount spent (usd)',
    'spend',
    'cost',
    'custo',
    'custo (brl)',
    'investimento',
    'valor gasto',
    'valor investido',
    'valor usado', // ← Meta BR
    'valor usado (brl)', // ← Meta BR with currency
  ],
  impressions: [
    'impressions',
    'impressoes',
    'impressões',
    'impr.',
    'impr',
  ],
  clicks: [
    'link clicks',
    'clicks',
    'cliques',
    'cliques no link',
    'cliques (todos)',
  ],
} as const

// Columns that signal a "period rollup" export (no per-day rows). When we
// detect these AND no daily date column, we ask the user to re-export with
// the "Por dia" breakdown enabled — importing a single row that aggregates
// 30 days of spend into one date is misleading.
const PERIOD_END_SYNONYMS = [
  'encerramento dos relatorios',
  'encerramento dos relatórios',
  'reporting ends',
]

export type CsvParseResult =
  | { ok: true; headers: string[]; rows: ParsedRow[] }
  | { ok: false; error: string }

export function parseCampaignCsv(text: string, campaigns: { id: string; name: string }[]): CsvParseResult {
  const { headers: hdrs, rows } = parseCsv(text)

  if (rows.length === 0) {
    return { ok: false, error: 'CSV vazio ou inválido' }
  }

  const idxCampaign = detectColumn(hdrs, HEADER_SYNONYMS.campaign)
  const idxDate = detectColumn(hdrs, HEADER_SYNONYMS.date)
  const idxSpend = detectColumn(hdrs, HEADER_SYNONYMS.spend)
  const idxImpressions = detectColumn(hdrs, HEADER_SYNONYMS.impressions)
  const idxClicks = detectColumn(hdrs, HEADER_SYNONYMS.clicks)
  // End-of-period column is used only to detect non-daily exports
  // (start != end on the same row → user forgot "Por dia").
  const idxPeriodEnd = detectColumn(hdrs, PERIOD_END_SYNONYMS)

  const missing: string[] = []
  if (idxCampaign < 0) missing.push('Nome da campanha')
  if (idxDate < 0) missing.push('Data / Dia')
  if (idxSpend < 0) missing.push('Investimento / Valor usado')

  if (missing.length > 0) {
    return {
      ok: false,
      error: `Não consegui identificar: ${missing.join(', ')}. Colunas encontradas: ${hdrs.join(', ')}`,
    }
  }

  const byName = new Map<string, string>()
  for (const c of campaigns) byName.set(c.name.toLowerCase().trim(), c.id)

  const out: ParsedRow[] = rows.map((row, i) => {
    const campaignName = (row[idxCampaign] || '').trim()
    const dateRaw = row[idxDate] || ''
    const date = parseDate(dateRaw) || ''
    const endRaw = idxPeriodEnd >= 0 ? row[idxPeriodEnd] || '' : ''
    const endDate = endRaw ? parseDate(endRaw) || '' : ''
    // Period rollup: start and end of the report differ → user didn't pick
    // "Por dia" in Meta. We reject the row to avoid attributing a whole
    // period's spend to a single date.
    const isPeriodRollup = !!endDate && endDate !== date

    const spend_cents = parseMoney(row[idxSpend] || '0')
    const impressions = idxImpressions >= 0 ? parseInt(row[idxImpressions] || '0', 10) || 0 : 0
    const clicks = idxClicks >= 0 ? parseInt(row[idxClicks] || '0', 10) || 0 : 0
    const matchedId = byName.get(campaignName.toLowerCase().trim())

    let warning: string | undefined
    if (isPeriodRollup) {
      warning = `Linha cobre ${date} → ${endDate}. Reexporte do Meta com "Detalhamento → Por dia".`
    } else if (!matchedId) {
      warning = `Campanha "${campaignName}" não está cadastrada`
    } else if (!date) {
      warning = `Data inválida: "${dateRaw}"`
    }

    return {
      rowNum: i + 2, // +1 for header, +1 for 1-based
      campaign_name: campaignName,
      date,
      spend_cents,
      impressions,
      clicks,
      matched: !!matchedId && !!date && !isPeriodRollup,
      campaign_id: matchedId,
      warning,
    }
  })

  return { ok: true, headers: hdrs, rows: out }
}
