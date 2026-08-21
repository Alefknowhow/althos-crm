'use client'

import { Fragment, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { FileSpreadsheet, Printer, Loader2, FileBarChart, ShoppingCart, CalendarDays, Coins, ChevronDown, ChevronRight, ExternalLink, Home } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getReport, type ReportType, type ReportData } from '@/actions/reports'
import { toCsv, downloadCsv } from '@/lib/reports/csv'

type Props = { orgSlug: string; isTravel?: boolean; isImobiliaria?: boolean }

const REPORTS: { type: ReportType; label: string; icon: React.ReactNode; travelOnly?: boolean; imobiliariaOnly?: boolean }[] = [
  { type: 'leads', label: 'Leads', icon: <FileBarChart className="h-4 w-4" /> },
  { type: 'sales', label: 'Vendas', icon: <ShoppingCart className="h-4 w-4" /> },
  { type: 'appointments', label: 'Agendamentos', icon: <CalendarDays className="h-4 w-4" /> },
  { type: 'commission', label: 'Comissões', icon: <Coins className="h-4 w-4" />, travelOnly: true },
  { type: 'imoveis', label: 'Imóveis', icon: <Home className="h-4 w-4" />, imobiliariaOnly: true },
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

function thisMonthRange(): { from: string; to: string } {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  return { from: ymd(from), to: ymd(now) }
}

function lastMonthRange(): { from: string; to: string } {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const to = new Date(now.getFullYear(), now.getMonth(), 0)
  return { from: ymd(from), to: ymd(to) }
}

const ERROR_MSG: Record<string, string> = {
  forbidden: 'Seu plano não inclui exportação de relatórios.',
  invalid_period: 'Período inválido.',
  invalid_type: 'Tipo de relatório inválido.',
  query_error: 'Erro ao buscar os dados. Tente novamente.',
}

export default function ReportsClient({ orgSlug, isTravel = false, isImobiliaria = false }: Props) {
  const reports = REPORTS.filter(r => (!r.travelOnly || isTravel) && (!r.imobiliariaOnly || isImobiliaria))
  const init = presetRange(30)
  const [type, setType] = useState<ReportType>('leads')
  const [from, setFrom] = useState(init.from)
  const [to, setTo] = useState(init.to)
  const [data, setData] = useState<ReportData | null>(null)
  const [pending, startTransition] = useTransition()
  const [expandedSeller, setExpandedSeller] = useState<string | null>(null)

  function applyPresetRange(r: { from: string; to: string }) {
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
      <div className="max-w-5xl space-y-6">
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
        <div className="rounded-none border bg-card p-5 space-y-4">
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
              { label: 'Este mês', range: thisMonthRange() },
              { label: 'Mês anterior', range: lastMonthRange() },
            ].map(p => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPresetRange(p.range)}
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
      </div>

      {/* Preview — largura total, sem o max-w-5xl acima, pra caber tabelas
          largas (ex: relatório de Vendas do nicho viagens) sem scroll. */}
      {showingForType && (
        <div className="rounded-none border bg-card overflow-hidden">
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
                    {showingForType.type === 'commission' && <th className="w-8" />}
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
                  {showingForType.rows.slice(0, 50).map((row, i) => {
                    const seller = String(row.seller ?? '')
                    const detail = showingForType.saleDetails?.find(d => d.seller === seller)
                    const isExpanded = showingForType.type === 'commission' && expandedSeller === seller
                    return (
                      <Fragment key={i}>
                        <tr
                          className={`border-b last:border-0 ${showingForType.type === 'commission' && detail?.sales.length ? 'cursor-pointer hover:bg-muted/20' : ''}`}
                          onClick={() => {
                            if (showingForType.type !== 'commission' || !detail?.sales.length) return
                            setExpandedSeller(isExpanded ? null : seller)
                          }}
                        >
                          {showingForType.type === 'commission' && (
                            <td className="px-2 py-2 text-muted-foreground">
                              {detail?.sales.length
                                ? (isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />)
                                : null}
                            </td>
                          )}
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
                        {isExpanded && detail && (
                          <tr className="border-b last:border-0 bg-muted/10">
                            <td colSpan={showingForType.columns.length + 1} className="px-3 py-2">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-muted-foreground">
                                    <th className="px-2 py-1 text-left font-medium">Localizador</th>
                                    <th className="px-2 py-1 text-left font-medium">Cliente</th>
                                    <th className="px-2 py-1 text-left font-medium">Operadora</th>
                                    <th className="px-2 py-1 text-right font-medium">Valor da venda</th>
                                    <th className="px-2 py-1 text-right font-medium">Comissão</th>
                                    <th className="px-2 py-1 text-left font-medium">Data</th>
                                    <th className="px-2 py-1 text-right font-medium" />
                                  </tr>
                                </thead>
                                <tbody>
                                  {detail.sales.map(s => (
                                    <tr key={s.saleId} className="border-t">
                                      <td className="px-2 py-1.5 whitespace-nowrap">{s.locator}</td>
                                      <td className="px-2 py-1.5 whitespace-nowrap">{s.client}</td>
                                      <td className="px-2 py-1.5 whitespace-nowrap">{s.operator}</td>
                                      <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{s.amount}</td>
                                      <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{s.commission}</td>
                                      <td className="px-2 py-1.5 whitespace-nowrap">{s.date}</td>
                                      <td className="px-2 py-1.5 text-right whitespace-nowrap">
                                        <Link
                                          href={`/app/${s.orgSlug}/reservas?sale=${s.saleId}`}
                                          target="_blank"
                                          className="inline-flex items-center gap-1 text-primary hover:underline"
                                          onClick={e => e.stopPropagation()}
                                        >
                                          Abrir reserva <ExternalLink className="h-3 w-3" />
                                        </Link>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
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
