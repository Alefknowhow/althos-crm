import Link from 'next/link'
import { ChevronRight, History, ChevronLeft } from 'lucide-react'
import {
  getAutomationRunsPage,
  getAutomationsForFilter,
  type RunRow,
} from '@/actions/automation-logs'
import {
  runDuration,
  triggerLabel,
  RUN_STATUS_LABEL,
} from '@/lib/automations/log-format'
import { Badge } from '@/components/ui/badge'
import LogsFilters from './LogsFilters'

export const dynamic = 'force-dynamic'

const STATUS_STYLE: Record<string, string> = {
  running:   'bg-blue-500/10 text-blue-600 border-blue-500/20',
  completed: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  failed:    'bg-red-500/10 text-red-600 border-red-500/20',
  cancelled: 'bg-muted text-muted-foreground border-border',
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={`text-xs font-medium ${STATUS_STYLE[status] ?? STATUS_STYLE.cancelled}`}
    >
      {RUN_STATUS_LABEL[status] ?? status}
    </Badge>
  )
}

export default async function AutomationLogsPage({
  params,
  searchParams,
}: {
  params: { orgSlug: string }
  searchParams: Record<string, string | string[] | undefined>
}) {
  const get = (k: string) => {
    const v = searchParams[k]
    return Array.isArray(v) ? v[0] : v
  }

  const page = Math.max(1, parseInt(get('page') ?? '1', 10) || 1)
  const status = get('status') ?? 'all'
  const automationId = get('automationId') ?? 'all'
  const search = get('search') ?? ''
  const from = get('from') ?? ''
  const to = get('to') ?? ''

  const [pageData, automations] = await Promise.all([
    getAutomationRunsPage(params.orgSlug, {
      page,
      status: status as any,
      automationId,
      search,
      // include the whole "to" day by pushing to end-of-day
      from: from || undefined,
      to: to ? `${to}T23:59:59.999Z` : undefined,
    }),
    getAutomationsForFilter(params.orgSlug),
  ])

  const { rows, total, pageSize } = pageData
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(total, page * pageSize)

  // Preserve filters when building pagination links.
  const baseParams = new URLSearchParams()
  if (status && status !== 'all') baseParams.set('status', status)
  if (automationId && automationId !== 'all') baseParams.set('automationId', automationId)
  if (search) baseParams.set('search', search)
  if (from) baseParams.set('from', from)
  if (to) baseParams.set('to', to)
  const pageHref = (p: number) => {
    const sp = new URLSearchParams(baseParams)
    if (p > 1) sp.set('page', String(p))
    const qs = sp.toString()
    return qs ? `?${qs}` : '?'
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <History className="w-5 h-5 text-muted-foreground" />
        <h2 className="text-base font-bold tracking-tight">Histórico de Execuções</h2>
      </div>

      <LogsFilters
        orgSlug={params.orgSlug}
        automations={automations}
        current={{ status, automationId, search, from, to }}
      />

      <div className="rounded-lg border bg-card overflow-hidden">
        {rows.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <History className="w-8 h-8 mx-auto mb-2 opacity-20" />
            <p className="text-sm font-medium">Nenhuma execução encontrada</p>
            <p className="text-xs mt-0.5">Ajuste os filtros ou aguarde novas execuções.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {rows.map((r: RunRow) => (
              <li key={r.id}>
                <Link
                  href={`/app/${params.orgSlug}/automacoes/logs/${r.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold truncate">
                        {r.automation_name ?? 'Automação removida'}
                      </span>
                      <StatusBadge status={r.status} />
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      <span className="truncate">
                        {r.lead?.name || r.lead?.email || 'Lead desconhecido'}
                      </span>
                      <span className="opacity-40">·</span>
                      <span className="shrink-0">{triggerLabel(r.trigger_type)}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs font-medium tabular-nums">
                      {runDuration(r.started_at, r.completed_at)}
                    </div>
                    <div className="text-xs text-muted-foreground tabular-nums">
                      {fmtDateTime(r.started_at)}
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {rangeStart}–{rangeEnd} de {total}
          </p>
          <div className="flex items-center gap-1">
            {page > 1 ? (
              <Link
                href={pageHref(page - 1)}
                className="inline-flex items-center h-8 px-2.5 rounded-md border text-xs hover:bg-muted transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-0.5" /> Anterior
              </Link>
            ) : (
              <span className="inline-flex items-center h-8 px-2.5 rounded-md border text-xs text-muted-foreground/40 cursor-default">
                <ChevronLeft className="w-3.5 h-3.5 mr-0.5" /> Anterior
              </span>
            )}
            <span className="text-xs text-muted-foreground px-2 tabular-nums">
              {page} / {totalPages}
            </span>
            {page < totalPages ? (
              <Link
                href={pageHref(page + 1)}
                className="inline-flex items-center h-8 px-2.5 rounded-md border text-xs hover:bg-muted transition-colors"
              >
                Próxima <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
              </Link>
            ) : (
              <span className="inline-flex items-center h-8 px-2.5 rounded-md border text-xs text-muted-foreground/40 cursor-default">
                Próxima <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
