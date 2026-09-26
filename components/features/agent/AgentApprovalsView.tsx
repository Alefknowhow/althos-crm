'use client'

/**
 * Issue #51 — UI mínima de revisão de ações de agente pendentes de
 * aprovação. Mesmo padrão de AgentTokensView.tsx (toast + router.refresh()
 * após cada ação, sem estado de lista espelhado no client).
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ShieldCheck, Loader2, Check, X } from 'lucide-react'
import { approveAgentAction, rejectAgentAction } from '@/actions/agent-approvals'
import type { PendingApproval } from '@/lib/agent/approvals'

/** Renderer legível por tool (issue #22, passo 3.4) — evita mostrar JSON
 *  cru pras mutation tools de Ads (as únicas que existem hoje com
 *  requiresApproval:true). Tool sem renderer específico cai no JSON padrão. */
const APPROVAL_RENDERERS: Record<string, (input: Record<string, unknown>) => string> = {
  ads_pause_campaign: input => `Pausar a campanha (id interno ${input.campaignId})`,
  ads_resume_campaign: input => `Retomar (ativar) a campanha (id interno ${input.campaignId})`,
  ads_update_budget: (input) => {
    const from = Number(input.currentDailyBudgetCents) / 100
    const to = Number(input.dailyBudgetCents) / 100
    const pct = from > 0 ? (((to - from) / from) * 100).toFixed(0) : '—'
    return `Orçamento diário: R$ ${from.toFixed(2)} → R$ ${to.toFixed(2)} (${Number(pct) >= 0 ? '+' : ''}${pct}%)`
  },
}

function renderApprovalInput(tool: string, input: Record<string, unknown> | null): string {
  if (!input) return ''
  const renderer = APPROVAL_RENDERERS[tool]
  if (renderer) {
    try { return renderer(input) } catch { /* cai pro JSON abaixo */ }
  }
  return JSON.stringify(input, null, 2)
}

const STATUS_LABEL: Record<PendingApproval['status'], string> = {
  pending: 'Pendente',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
}
const STATUS_VARIANT: Record<PendingApproval['status'], 'default' | 'secondary' | 'destructive'> = {
  pending: 'default',
  approved: 'secondary',
  rejected: 'destructive',
}

export default function AgentApprovalsView({
  orgSlug, initial, initialError,
}: {
  orgSlug: string
  initial: PendingApproval[]
  initialError: string | null
}) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)

  const pending = initial.filter(a => a.status === 'pending')
  const reviewed = initial.filter(a => a.status !== 'pending')

  async function handleApprove(id: string) {
    setBusyId(id)
    const res = await approveAgentAction(orgSlug, id)
    setBusyId(null)
    if (!res.ok) { toast.error(res.error); return }
    toast.success(res.executed ? 'Ação executada' : 'Aprovado')
    router.refresh()
  }

  async function handleReject(id: string) {
    if (!confirm('Rejeitar esta ação? Ela não será executada.')) return
    setBusyId(id)
    const res = await rejectAgentAction(orgSlug, id)
    setBusyId(null)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Rejeitado')
    router.refresh()
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2"><ShieldCheck className="w-5 h-5" /> Aprovações de IA</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Ações que um agente de IA pediu pra executar e que exigem sua confirmação antes de acontecer de verdade.
        </p>
      </div>

      {initialError && <p className="text-sm text-destructive">{initialError}</p>}

      <Card>
        <CardHeader><CardTitle className="text-base">Pendentes {pending.length > 0 && `(${pending.length})`}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nada pendente no momento.</p>
          ) : (
            pending.map(a => (
              <div key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-3.5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{a.tool}</p>
                  <p className="text-xs text-muted-foreground truncate">agente: {a.agent_label} · {new Date(a.created_at).toLocaleString('pt-BR')}</p>
                  {a.input && (
                    APPROVAL_RENDERERS[a.tool] ? (
                      <p className="mt-1.5 text-xs bg-muted/50 rounded-lg px-2.5 py-1.5 max-w-xl">{renderApprovalInput(a.tool, a.input)}</p>
                    ) : (
                      <pre className="mt-1.5 text-[11px] bg-muted/50 rounded-lg px-2 py-1.5 overflow-x-auto max-w-xl">{renderApprovalInput(a.tool, a.input)}</pre>
                    )
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button size="sm" variant="outline" disabled={busyId === a.id} onClick={() => handleReject(a.id)}>
                    {busyId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                  </Button>
                  <Button size="sm" disabled={busyId === a.id} onClick={() => handleApprove(a.id)}>
                    {busyId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span className="ml-1">Aprovar</span>
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {reviewed.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Histórico</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {reviewed.map(a => (
              <div key={a.id} className="flex items-center justify-between gap-3 text-sm py-1.5 border-b border-border/40 last:border-0">
                <div className="min-w-0">
                  <span className="font-medium">{a.tool}</span>
                  <span className="text-muted-foreground"> · {a.agent_label}</span>
                </div>
                <Badge variant={STATUS_VARIANT[a.status]}>{STATUS_LABEL[a.status]}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
