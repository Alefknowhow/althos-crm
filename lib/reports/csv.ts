/**
 * Tiny, dependency-free CSV utilities (client-safe).
 *
 * "Exportar Excel" in the product = a UTF-8 CSV. A leading BOM (﻿) makes
 * Excel open it with the right encoding so accents (ã, ç, é…) don't break, and
 * CRLF line endings keep legacy Excel happy. No external lib needed.
 */

export type CsvCell = string | number | null | undefined

function escapeCell(value: CsvCell): string {
  const s = value == null ? '' : String(value)
  // Quote when the cell contains a delimiter, quote, or newline.
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/** Build a CSV string from headers + rows. Prepends a UTF-8 BOM for Excel. */
export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [
    headers.map(escapeCell).join(','),
    ...rows.map(row => row.map(escapeCell).join(',')),
  ]
  return '﻿' + lines.join('\r\n')
}

/** Trigger a client-side download of a CSV string. Browser-only. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
