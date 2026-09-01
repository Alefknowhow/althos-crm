'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Workflow } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { getLeadAutomationRuns } from '@/actions/automations'

type Run = {
  id: string
  status: string
  current_step: number | null
  started_at: string
  completed_at: string | null
  automations: { name: string } | { name: string }[] | null
}

const STATUS_META: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  running: { label: 'Em andamento', variant: 'secondary' },
  completed: { label: 'Concluído', variant: 'default' },
  failed: { label: 'Falhou', variant: 'destructive' },
}

/**
 * Fluxos automáticos vinculados a este lead (automation_runs) — reaproveita
 * o motor de automações já existente (trigger + steps, incl. "wait" pra
 * follow-up com atraso) em vez de um mecanismo novo só pra WhatsApp. Autoria
 * de fluxo continua em Automações; aqui é só o status por lead.
 */
export default function LeadFlowsTab({ orgSlug, leadId }: { orgSlug: string; leadId: string }) {
  const [runs, setRuns] = useState<Run[] | null>(null)

  useEffect(() => {
    let active = true
    setRuns(null)
    getLeadAutomationRuns(orgSlug, leadId).then(data => { if (active) setRuns(data as Run[]) })
    return () => { active = false }
  }, [orgSlug, leadId])

  const name = (r: Run) => Array.isArray(r.automations) ? r.automations[0]?.name : r.automations?.name

  return (
    <div className="space-y-3">
      {runs === null ? (
        <div className="flex justify-center py-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>
      ) : runs.length === 0 ? (
        <div className="text-center py-6 space-y-2 border rounded-lg">
          <Workflow className="w-5 h-5 mx-auto text-muted-foreground/50" />
          <p className="text-xs text-muted-foreground">Nenhum fluxo automático rodou pra este lead ainda.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {runs.map(r => {
            const meta = STATUS_META[r.status] || { label: r.status, variant: 'outline' as const }
            return (
              <div key={r.id} className="rounded-lg border p-3 text-sm space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{name(r) || 'Automação removida'}</span>
                  <Badge variant={meta.variant} className="text-[10px] shrink-0">{meta.label}</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Iniciado em {new Date(r.started_at).toLocaleString('pt-BR')}
                  {r.status === 'running' && r.current_step != null && ` · etapa ${r.current_step + 1}`}
                </p>
              </div>
            )
          })}
        </div>
      )}
      <Link href={`/app/${orgSlug}/automacoes`} className="block text-center text-xs text-primary hover:underline pt-1">
        Configurar fluxos de follow-up em Automações
      </Link>
    </div>
  )
}
