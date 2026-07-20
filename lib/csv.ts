/**
 * Helpers compartilhados de import de CSV — extraídos de
 * components/features/marketing/CsvImporter.tsx pra serem reaproveitados
 * por outros importadores (ex.: extrato bancário do Financeiro).
 */

export function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

export function detectColumn(headers: string[], keys: readonly string[]): number {
  const normalized = headers.map(normalizeHeader)
  for (const key of keys) {
    const idx = normalized.indexOf(normalizeHeader(key))
    if (idx >= 0) return idx
  }
  return -1
}

export function parseDate(s: string): string | null {
  // Accept ISO (YYYY-MM-DD), BR (DD/MM/YYYY), US (MM/DD/YYYY → harder, skipping).
  const trimmed = s.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  const br = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (br) return `${br[3]}-${br[2]}-${br[1]}`
  // Fallback: let Date.parse try.
  const d = new Date(trimmed)
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return null
}

export function parseMoney(s: string): number {
  // Robust against BR ("1.234,56", "100,50") and US ("1,234.56", "100.50")
  // number formats. Both are common in Ads exports depending on locale.
  // Strategy: figure out which separator is the decimal by looking at the
  // last comma vs last dot position — whichever is closer to the end wins.
  const raw = s.replace(/[R$\s]/g, '').trim()
  if (!raw) return 0
  const lastComma = raw.lastIndexOf(',')
  const lastDot = raw.lastIndexOf('.')
  let normalized: string
  if (lastComma === -1 && lastDot === -1) {
    normalized = raw
  } else if (lastComma > lastDot) {
    // BR: comma is decimal, dots are thousands separators.
    normalized = raw.replace(/\./g, '').replace(',', '.')
  } else {
    // US: dot is decimal, commas are thousands separators.
    normalized = raw.replace(/,/g, '')
  }
  const n = parseFloat(normalized)
  return isNaN(n) ? 0 : Math.round(n * 100)
}

export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  // Minimal CSV parser: handles commas, semicolons, and quoted fields.
  // Not RFC-strict — fine for export files from Meta/Google/bank statements.
  const sep = text.includes(';') && !text.includes(',') ? ';' : ','
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length === 0) return { headers: [], rows: [] }

  function parseLine(line: string): string[] {
    const out: string[] = []
    let cur = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"'
          i++
        } else inQuotes = !inQuotes
      } else if (ch === sep && !inQuotes) {
        out.push(cur)
        cur = ''
      } else cur += ch
    }
    out.push(cur)
    return out
  }

  const headers = parseLine(lines[0])
  const rows = lines.slice(1).map(parseLine)
  return { headers, rows }
}
