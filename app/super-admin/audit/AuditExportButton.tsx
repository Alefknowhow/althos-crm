'use client'

import { Download } from 'lucide-react'
import type { AuditLogEntry } from '@/actions/super-admin'

function csvEscape(v: string | number): string {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export default function AuditExportButton({ logs }: { logs: AuditLogEntry[] }) {
  function download() {
    const header = ['data_hora', 'acao', 'super_admin_email', 'super_admin_id', 'organizacao', 'org_slug']
    const lines = [
      header.join(','),
      ...logs.map(l =>
        [
          new Date(l.created_at).toISOString(),
          l.action,
          l.super_admin_email ?? '',
          l.super_admin_user_id,
          l.org_name ?? '',
          l.org_slug ?? '',
        ].map(csvEscape).join(','),
      ),
    ]
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={download}
      disabled={logs.length === 0}
      className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10 disabled:opacity-50"
    >
      <Download className="w-3.5 h-3.5" /> Exportar CSV
    </button>
  )
}
