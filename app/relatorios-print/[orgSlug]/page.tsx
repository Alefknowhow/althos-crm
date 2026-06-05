import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/supabase/types'
import { getReport, type ReportType } from '@/actions/reports'
import AutoPrint from '@/components/features/reports/AutoPrint'

export const dynamic = 'force-dynamic'

const VALID: ReportType[] = ['leads', 'sales', 'appointments', 'commission']

/**
 * Printable report view. Lives OUTSIDE the /app/[orgSlug] subtree so it doesn't
 * inherit the dashboard sidebar/header — only the root layout (html/body). The
 * user opens this in a new tab; AutoPrint fires the browser's print → save-as-PDF.
 */
export default async function RelatorioPrintPage({
  params,
  searchParams,
}: {
  params: { orgSlug: string }
  searchParams: { type?: string; from?: string; to?: string }
}) {
  await requireAuth()

  const type = (searchParams.type ?? '') as ReportType
  const from = searchParams.from ?? ''
  const to = searchParams.to ?? ''
  if (!VALID.includes(type) || !from || !to) notFound()

  const res = await getReport(params.orgSlug, type, from, to)
  if (!res.ok) {
    if (res.error === 'forbidden') notFound()
    return <div style={{ padding: 40, fontFamily: 'system-ui, sans-serif' }}>Não foi possível gerar o relatório.</div>
  }

  const d = res.data
  const generated = new Date(d.generatedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })

  return (
    <div className="report-print">
      <style>{`
        .report-print {
          background: #fff; color: #111; min-height: 100vh;
          font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
          font-size: 12px; padding: 32px 28px;
          -webkit-print-color-adjust: exact; print-color-adjust: exact;
        }
        .report-print .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 16px; }
        .report-print .org { font-size: 18px; font-weight: 700; }
        .report-print .subtitle { font-size: 13px; color: #444; margin-top: 2px; }
        .report-print .meta { text-align: right; font-size: 11px; color: #555; line-height: 1.5; }
        .report-print table { width: 100%; border-collapse: collapse; }
        .report-print th, .report-print td { padding: 6px 8px; border-bottom: 1px solid #ddd; text-align: left; vertical-align: top; }
        .report-print th { background: #f3f4f6; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: .02em; color: #374151; }
        .report-print td.right, .report-print th.right { text-align: right; }
        .report-print tbody tr:nth-child(even) { background: #fafafa; }
        .report-print tfoot td { font-weight: 700; border-top: 2px solid #111; border-bottom: none; padding-top: 8px; }
        .report-print .empty { padding: 40px; text-align: center; color: #777; }
        .report-print .foot { margin-top: 24px; font-size: 10px; color: #999; text-align: center; }
        @media print {
          .report-print { padding: 0; }
          .report-print thead { display: table-header-group; }
          .report-print tr { page-break-inside: avoid; }
        }
      `}</style>

      <AutoPrint />

      <div className="head">
        <div>
          <div className="org">{d.orgName}</div>
          <div className="subtitle">{d.title}</div>
        </div>
        <div className="meta">
          <div>Período: {d.periodLabel}</div>
          <div>Gerado em: {generated}</div>
          <div>{d.rows.length} registro(s)</div>
        </div>
      </div>

      {d.rows.length === 0 ? (
        <div className="empty">Nenhum registro no período selecionado.</div>
      ) : (
        <table>
          <thead>
            <tr>
              {d.columns.map(c => (
                <th key={c.key} className={c.align === 'right' ? 'right' : ''}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.rows.map((row, i) => (
              <tr key={i}>
                {d.columns.map(c => (
                  <td key={c.key} className={c.align === 'right' ? 'right' : ''}>{row[c.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
          {d.totals && (
            <tfoot>
              <tr>
                {d.columns.map(c => (
                  <td key={c.key} className={c.align === 'right' ? 'right' : ''}>{d.totals?.[c.key] ?? ''}</td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      )}

      <div className="foot">Gerado por Althos CRM</div>
    </div>
  )
}
