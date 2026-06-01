import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft, CheckCircle2, XCircle, MinusCircle, Clock,
  User, Zap, AlertTriangle,
} from 'lucide-react'
import { getRunDetail, type StepLog } from '@/actions/automation-logs'
import {
  stepLabel, triggerLabel, formatDuration, runDuration, RUN_STATUS_LABEL,
} from '@/lib/automations/log-format'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

const STATUS_STYLE: Record<string, string> = {
  running:   'bg-blue-500/10 text-blue-600 border-blue-500/20',
  completed: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  failed:    'bg-red-500/10 text-red-600 border-red-500/20',
  cancelled: 'bg-muted text-muted-foreground border-border',
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function StepIcon({ status }: { status: string }) {
  if (status === 'success') return <CheckCircle2 className="w-4 h-4 text-emerald-500" />
  if (status === 'error')   return <XCircle className="w-4 h-4 text-red-500" />
  return <MinusCircle className="w-4 h-4 text-muted-foreground/50" />
}

function JsonBlock({ label, data }: { label: string; data: any }) {
  if (data == null || (typeof data === 'object' && Object.keys(data).length === 0)) return null
  return (
    <div className="mt-2">
      <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
      <pre className="text-xs bg-muted/60 rounded-md p-2.5 overflow-x-auto leading-relaxed border">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  )
}

export default async function RunDetailPage({
  params,
}: {
  params: { orgSlug: string; runId: string }
}) {
  const detail = await getRunDetail(params.orgSlug, params.runId)
  if (!detail) notFound()

  const { run, stepLogs } = detail

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <Link
        href={`/app/${params.orgSlug}/automacoes/logs`}
        className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Voltar ao histórico
      </Link>

      {/* Run summary */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary shrink-0" />
              <h2 className="text-base font-bold tracking-tight truncate">
                {run.automation_name ?? 'Automação removida'}
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Gatilho: {triggerLabel(run.trigger_type)}
            </p>
          </div>
          <Badge
            variant="outline"
            className={`text-xs font-medium shrink-0 ${STATUS_STYLE[run.status] ?? STATUS_STYLE.cancelled}`}
          >
            {RUN_STATUS_LABEL[run.status] ?? run.status}
          </Badge>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <User className="w-3 h-3" /> Lead
            </p>
            <p className="font-medium truncate">
              {run.lead?.name || run.lead?.email || 'Desconhecido'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" /> Duração total
            </p>
            <p className="font-medium tabular-nums">
              {runDuration(run.started_at, run.completed_at)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Início</p>
            <p className="font-medium tabular-nums text-xs">{fmtDateTime(run.started_at)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Término</p>
            <p className="font-medium tabular-nums text-xs">{fmtDateTime(run.completed_at)}</p>
          </div>
        </div>

        {run.error && (
          <div className="flex items-start gap-2 rounded-md bg-red-500/10 border border-red-500/20 p-2.5">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-600 break-words">{run.error}</p>
          </div>
        )}

        <JsonBlock label="Payload recebido (gatilho)" data={run.trigger_payload} />
      </div>

      {/* Timeline */}
      <div>
        <h3 className="text-sm font-semibold mb-2 px-1">Linha do tempo</h3>
        {stepLogs.length === 0 ? (
          <div className="rounded-lg border bg-card py-10 text-center text-muted-foreground">
            <Clock className="w-7 h-7 mx-auto mb-2 opacity-20" />
            <p className="text-sm">Nenhum passo registrado ainda.</p>
            {run.status === 'running' && (
              <p className="text-xs mt-0.5">A execução ainda está em andamento.</p>
            )}
          </div>
        ) : (
          <ol className="relative border-l-2 border-border/60 ml-2 space-y-3">
            {stepLogs.map((log: StepLog, i: number) => {
              const payload = log.metadata?.payload
              const stack = log.metadata?.stack
              return (
                <li key={log.id} className="ml-5">
                  <span className="absolute -left-[9px] flex items-center justify-center w-4 h-4 rounded-full bg-card ring-2 ring-card">
                    <StepIcon status={log.status} />
                  </span>
                  <div className="rounded-lg border bg-card p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-mono text-muted-foreground tabular-nums">
                          #{(log.step_index ?? i) + 1}
                        </span>
                        <span className="text-sm font-semibold truncate">
                          {stepLabel(log.step_type)}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                        {formatDuration(log.duration_ms)}
                      </span>
                    </div>

                    {log.message && (
                      <p className={`text-xs mt-1 break-words ${log.status === 'error' ? 'text-red-600' : 'text-muted-foreground'}`}>
                        {log.message}
                      </p>
                    )}

                    {(log.started_at || log.completed_at) && (
                      <p className="text-xs text-muted-foreground/70 mt-1 tabular-nums">
                        {fmtDateTime(log.started_at)}
                        {log.completed_at ? ` → ${fmtDateTime(log.completed_at)}` : ''}
                      </p>
                    )}

                    <JsonBlock label="Payload enviado" data={payload} />
                    {stack && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-red-600 mb-1">Stack trace</p>
                        <pre className="text-xs bg-red-500/5 text-red-700 rounded-md p-2.5 overflow-x-auto leading-relaxed border border-red-500/20">
                          {stack}
                        </pre>
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </div>
  )
}
