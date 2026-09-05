'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export type Lead = { id: string; name: string | null; email: string | null }

export type Run = {
  id: string
  status: 'running' | 'completed' | 'failed' | string
  current_step: number
  error: string | null
  started_at: string
  completed_at: string | null
  contatos: Lead | Lead[] | null
}

export type Step = {
  id: string
  type: string
  config: Record<string, any>
}

const STEP_LABEL: Record<string, string> = {
  wait: 'Esperar',
  send_email: 'E-mail',
  send_whatsapp: 'WhatsApp',
  create_task: 'Tarefa',
  move_stage: 'Estágio',
  add_tag: 'Tag',
  close_deal: 'Fechar Negociação',
  send_push: 'Notificação Push',
  webhook: 'Webhook Externo',
}

export const STATUS_META: Record<
  string,
  { label: string; cls: string; icon: any }
> = {
  running: {
    label: 'Em andamento',
    cls: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300',
    icon: Loader2,
  },
  completed: {
    label: 'Concluída',
    cls: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300',
    icon: CheckCircle2,
  },
  failed: {
    label: 'Falhou',
    cls: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300',
    icon: XCircle,
  },
}

function pickFirst<T>(x: T | T[] | null | undefined): T | null {
  if (!x) return null
  return Array.isArray(x) ? x[0] || null : x
}

function describeStep(step: Step): string {
  if (!step) return '—'
  const base = STEP_LABEL[step.type] || step.type
  if (step.type === 'wait') {
    const u = step.config?.unit || 'minutes'
    const n = step.config?.amount || 1
    const unit = u === 'minutes' ? 'min' : u === 'hours' ? 'h' : u === 'days' ? 'd' : u
    return `${base} ${n}${unit}`
  }
  if (step.type === 'create_task' && step.config?.title) return `${base}: ${step.config.title}`
  if (step.type === 'add_tag' && step.config?.tag) return `${base}: ${step.config.tag}`
  return base
}

function durationLabel(startIso: string, endIso: string | null): string {
  const start = new Date(startIso).getTime()
  const end = endIso ? new Date(endIso).getTime() : Date.now()
  const ms = end - start
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}min`
  if (ms < 86_400_000) return `${(ms / 3_600_000).toFixed(1)}h`
  return `${Math.round(ms / 86_400_000)}d`
}

/** Um card de execução da automação — resumo (linha clicável) + detalhe
 *  expansível com os passos. Extraído de AutomationRunsPanel.tsx pra manter
 *  o arquivo dentro do limite de 350 linhas. */
export default function AutomationRunCard({
  orgSlug, run, steps, isOpen, onToggle,
}: {
  orgSlug: string
  run: Run
  steps: Step[]
  isOpen: boolean
  onToggle: () => void
}) {
  const lead = pickFirst(run.contatos)
  const status = STATUS_META[run.status] || STATUS_META.running
  const Icon = status.icon
  const totalSteps = steps.length || run.current_step + 1
  const currentStepDef = steps[run.current_step]

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left p-4 flex items-start gap-3 hover:bg-muted/30 transition-colors"
      >
        <div className="shrink-0 mt-0.5">
          <Icon
            className={`w-5 h-5 ${
              run.status === 'running'
                ? 'text-blue-600 animate-spin'
                : run.status === 'completed'
                  ? 'text-green-600'
                  : 'text-red-600'
            }`}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge className={status.cls + ' border'}>{status.label}</Badge>
            {lead ? (
              <Link
                href={`/app/${orgSlug}/contatos/${lead.id}`}
                onClick={e => e.stopPropagation()}
                className="text-sm font-medium hover:underline inline-flex items-center gap-1"
              >
                {lead.name || 'Sem nome'}
                <ExternalLink className="w-3 h-3" />
              </Link>
            ) : (
              <span className="text-sm text-muted-foreground italic">Lead removido</span>
            )}
            {lead?.email && (
              <span className="text-xs text-muted-foreground">{lead.email}</span>
            )}
          </div>

          {/* Progress bar */}
          {steps.length > 0 && run.status !== 'failed' && (
            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-1.5">
                {steps.map((s, i) => {
                  const done = run.status === 'completed' || i < run.current_step
                  const active = run.status === 'running' && i === run.current_step
                  return (
                    <div
                      key={s.id || i}
                      className={`flex-1 h-1.5 rounded-full transition-colors ${
                        done
                          ? 'bg-green-500'
                          : active
                            ? 'bg-blue-500 animate-pulse'
                            : 'bg-muted'
                      }`}
                      title={describeStep(s)}
                    />
                  )
                })}
              </div>
              <div className="text-xs text-muted-foreground">
                {run.status === 'completed'
                  ? `Concluído (${totalSteps} passos)`
                  : `Passo ${run.current_step + 1} de ${totalSteps}${currentStepDef ? ` — ${describeStep(currentStepDef)}` : ''}`}
              </div>
            </div>
          )}

          {run.status === 'failed' && run.error && (
            <div className="mt-2 flex items-start gap-1.5 text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md px-2 py-1.5">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span className="line-clamp-2">{run.error}</span>
            </div>
          )}
        </div>

        <div className="shrink-0 text-right">
          <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDistanceToNow(new Date(run.started_at), {
              addSuffix: true,
              locale: ptBR,
            })}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            duração: {durationLabel(run.started_at, run.completed_at)}
          </div>
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground inline mt-1" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground inline mt-1" />
          )}
        </div>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 pt-2 border-t bg-muted/20 text-sm space-y-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <div>
              <span className="text-muted-foreground">Iniciado em:</span>{' '}
              <span className="font-medium">
                {new Date(run.started_at).toLocaleString('pt-BR')}
              </span>
            </div>
            {run.completed_at && (
              <div>
                <span className="text-muted-foreground">Concluído em:</span>{' '}
                <span className="font-medium">
                  {new Date(run.completed_at).toLocaleString('pt-BR')}
                </span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Run ID:</span>{' '}
              <code className="text-[10px] font-mono">{run.id.slice(0, 8)}…</code>
            </div>
          </div>

          {steps.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-1.5">Passos da automação</div>
              <ol className="space-y-1">
                {steps.map((s, i) => {
                  const done = run.status === 'completed' || i < run.current_step
                  const active = run.status === 'running' && i === run.current_step
                  const failed = run.status === 'failed' && i === run.current_step
                  return (
                    <li
                      key={s.id || i}
                      className={`flex items-center gap-2 text-xs ${
                        done ? '' : active ? 'font-medium' : 'text-muted-foreground'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 ${
                          done
                            ? 'bg-green-500 text-white'
                            : active
                              ? 'bg-blue-500 text-white'
                              : failed
                                ? 'bg-red-500 text-white'
                                : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {done ? '✓' : failed ? '!' : i + 1}
                      </div>
                      <span>{describeStep(s)}</span>
                    </li>
                  )
                })}
              </ol>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
