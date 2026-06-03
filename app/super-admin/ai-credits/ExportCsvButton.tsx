'use client'

import { Download } from 'lucide-react'

type Row = {
  account_id: string
  name:       string
  plan:       string
  included:   number
  purchased:  number
  used:       number
  remaining:  number
}

function csvEscape(v: string | number): string {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export default function ExportCsvButton({ rows, period }: { rows: Row[]; period: string }) {
  function download() {
    const header = ['account_id', 'conta', 'plano', 'incluidos', 'comprados', 'usados', 'restantes']
    const lines = [
      header.join(','),
      ...rows.map(r =>
        [r.account_id, r.name, r.plan, r.included, r.purchased, r.used, r.remaining]
          .map(csvEscape)
          .join(','),
      ),
    ]
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `creditos-ia-${period}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={download}
      disabled={rows.length === 0}
      className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10 disabled:opacity-50"
    >
      <Download className="w-3.5 h-3.5" /> Exportar CSV
    </button>
  )
}
