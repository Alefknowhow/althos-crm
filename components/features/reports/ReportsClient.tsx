'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { FileSpreadsheet, Printer, Loader2, FileBarChart, ShoppingCart, CalendarDays, Coins } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getReport, type ReportType, type ReportData } from '@/actions/reports'
import { toCsv, downloadCsv } from '@/lib/reports/csv'

type Props = { orgSlug: string; isTravel?: boolean }

const REPORTS: { type: ReportType; label: string; icon: React.ReactNode; travelOnly?: boolean }[] = [
  { type: 'leads', label: 'Leads', icon: <FileBarChart className="h-4 w-4" /> },
  { type: 'sales', label: 'Vendas', icon: <ShoppingCart className="h-4 w-4" /> },
  { type: 'appointments', label: 'Agendamentos', icon: <CalendarDays className="h-4 w-4" /> },
  { type: 'commission', label: 'Comissões', icon: <Coins className="h-4 w-4" />, travelOnly: true },
]

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function presetRange(days: number): { from: string; to: string } {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - (days - 1))
  return { from: ymd(from), to: ymd(to) }
}

const ERROR_MSG: Record<string, string> = {
  forbidden: 'Seu plano não inclui exportação de relatórios.',
  invalid_period: 'Período inválido.',
  invalid_type: 'Tipo de relatório inválido.',
  query_error: 'Erro ao buscar os dados. Tente novamente.',
}

export default function ReportsClient({ orgSlug, isTravel = false }: Props) {
  const reports = REPORTS.filter(r => !r.travelOnly || isTravel)
  const init = presetRange(30)
  const [type, setType] = useState<ReportType>('leads')
  const [from, setFrom] = useState(init.from)
  const [to, setTo] = useState(init.to)
  const [data, setData] = useState<ReportData | null>(null)
  const [pending, startTransition] = useTransition()

  function applyPreset(days: number) {
    const r = presetRange(days)
    setFrom(r.from)
    setTo(r.to)
  }

  function generate(): Promise<ReportData | null> {
    return new Promise(resolve => {
      startTransition(async () => {
        const res = await getReport(orgSlug, type, from, to)
        if (res.ok) {
          setData(res.data)
          resolve(res.data)
        } else {
          setData(null)
          toast.error(ERROR_MSG[res.error] || 'Não foi possível gerar o relatório.')
          resolve(null)
        }
      })
    })
  }

  function exportCsv(d: ReportData) {
    const headers = d.columns.map(c => c.label)
    const rows = d.rows.map(r => d.columns.map(c => r[c.key] ?? ''))
    const csv = toCsv(headers, rows)
    downloadCsv(`${d.type}-${d.from}_${d.to}`, csv)
  }

  async function handleExcel() {
    const d = data && data.type === type ? data : await generate()
    if (!d) return
    if (d.rows.length === 0) {
      toast.info('Nenhum registro no período selecionado.')
      return
    }
    exportCsv(d)
  }

  function handlePdf() {
    const url = `/relatorios-print/${orgSlug}?type=${type}&from=${from}&to=${to}`
    window.open(url, '_blank', 'noopener')
  }

  const showingForType = data && data.type === type ? data : null

  return (
    <div className="space-y-6">
      {/* Report type selector */}
      <div className="flex flex-wrap gap-2">
        {reports.map(r => (
          <button
            key={r.type}
            type="button"
            onClick={() => setType(r.type)}
            className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
              type === r.type
                ? 'border-primary bg-primary/10 text-primary'
                : 'bg-card hover:bg-accent/40'
            }`}
          >
            {r.icon}
            {r.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-4 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">De</Label>
            <Input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Até</Label>
            <Input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} />
          </div>
          <Button onClick={() => generate()} disabled={pending} variant="secondary">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Pré-visualizar'}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { label: '7 dias', days: 7 },
            { label: '30 dias', days: 30 },
            { label: '90 dias', days: 90 },
          ].map(p => (
            <button
              key={p.days}
              type="button"
              onClick={() => applyPreset(p.days)}
              className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-accent/40"
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 pt-1 border-t">
          <Button onClick={handleExcel} disabled={pending} className="mt-3">
            <FileSpreadsheet className="h-4 w-4 mr-1.5" /> Exportar Excel
          </Button>
          <Button onClick={handlePdf} disabled={pending} variant="outline" className="mt-3">
            <Printer className="h-4 w-4 mr-1.5" /> Exportar PDF
          </Button>
        </div>
      </div>

      {/* Preview */}
      {showingForType && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b flex items-center justify-between">
            <h2 className="text-sm font-semibold">{showingForType.title}</h2>
            <span className="text-xs text-muted-foreground">
              {showingForType.rows.length} registro(s) · {showingForType.periodLabel}
            </span>
          </div>
          {showingForType.rows.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-muted-foreground">
              Nenhum registro no período.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    {showingForType.columns.map(c => (
                      <th
                        key={c.key}
                        className={`px-3 py-2 font-medium text-muted-foreground whitespace-nowrap ${
                          c.align === 'right' ? 'text-right' : 'text-left'
                        }`}
                      >
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {showingForType.rows.slice(0, 50).map((row, i) => (
                    <tr key={i} className="border-b last:border-0">
                      {showingForType.columns.map(c => (
                        <td
                          key={c.key}
                          className={`px-3 py-2 whitespace-nowrap ${
                            c.align === 'right' ? 'text-right tabular-nums' : 'text-left'
                          }`}
                        >
                          {row[c.key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {showingForType.rows.length > 50 && (
                <p className="px-5 py-2 text-xs text-muted-foreground border-t">
                  Mostrando 50 de {showingForType.rows.length}. A exportação inclui todos os registros.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
