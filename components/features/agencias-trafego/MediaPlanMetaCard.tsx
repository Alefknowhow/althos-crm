'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Plus, CheckCircle2, Loader2 } from 'lucide-react'
import type { MediaPlan, MediaPlanPlatform } from '@/actions/media-plans'
import { PLATFORM_LABEL, centsFromInput, reaisFromCents } from '@/components/features/agencias-trafego/media-plan-shared'

/** Card de metadados do plano (nome/objetivo/período/orçamento/metas/
 *  observações) + seletor de versão — extraído de MediaPlanBuilder.tsx só
 *  por tamanho de arquivo, sem mudança de comportamento. */
export default function MediaPlanMetaCard({
  plans, activePlan, activePlanId, isPending, onSwitchPlan, onCreatePlan, onPatch, onSave, onApprove,
}: {
  plans: MediaPlan[]
  activePlan: MediaPlan | null
  activePlanId: string | null
  isPending: boolean
  onSwitchPlan: (id: string) => void
  onCreatePlan: () => void
  onPatch: (patch: Partial<MediaPlan>) => void
  onSave: () => void
  onApprove: () => void
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm">Plano de mídia</CardTitle>
        <div className="flex items-center gap-2">
          <Select value={activePlanId ?? undefined} onValueChange={onSwitchPlan}>
            <SelectTrigger className="h-8 text-xs w-48"><SelectValue placeholder="Selecionar plano" /></SelectTrigger>
            <SelectContent>
              {plans.map(p => (
                <SelectItem key={p.id} value={p.id}>v{p.version} — {p.status === 'approved' ? 'Aprovado' : p.status === 'archived' ? 'Arquivado' : 'Rascunho'}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={onCreatePlan} disabled={isPending}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Nova versão
          </Button>
        </div>
      </CardHeader>
      {activePlan && (
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={activePlan.status === 'approved' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-muted'}>
              {activePlan.status === 'approved' ? 'Aprovado' : activePlan.status === 'archived' ? 'Arquivado' : 'Rascunho'}
            </Badge>
            {activePlan.status !== 'approved' && (
              <Button size="sm" variant="outline" onClick={onApprove} disabled={isPending}>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Aprovar
              </Button>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="space-y-1 flex-1 min-w-[180px]">
              <Label className="text-xs">Nome do plano</Label>
              <Input value={activePlan.name} onChange={e => onPatch({ name: e.target.value })} className="h-8 text-sm" />
            </div>
            <div className="space-y-1 flex-1 min-w-[180px]">
              <Label className="text-xs">Objetivo principal</Label>
              <Input value={activePlan.objective_primary ?? ''} onChange={e => onPatch({ objective_primary: e.target.value })} className="h-8 text-sm" placeholder="Ex.: gerar leads qualificados" />
            </div>
            <div className="space-y-1 w-36">
              <Label className="text-xs">Início</Label>
              <Input type="date" value={activePlan.period_start ?? ''} onChange={e => onPatch({ period_start: e.target.value })} className="h-8 text-sm" />
            </div>
            <div className="space-y-1 w-36">
              <Label className="text-xs">Fim</Label>
              <Input type="date" value={activePlan.period_end ?? ''} onChange={e => onPatch({ period_end: e.target.value })} className="h-8 text-sm" />
            </div>
            <div className="space-y-1 w-32">
              <Label className="text-xs">Orçamento (R$)</Label>
              <Input value={reaisFromCents(activePlan.budget_total_cents)} onChange={e => onPatch({ budget_total_cents: centsFromInput(e.target.value) })} className="h-8 text-sm" />
            </div>
            <div className="space-y-1 w-28">
              <Label className="text-xs">Meta leads</Label>
              <Input value={activePlan.target_leads ?? ''} onChange={e => onPatch({ target_leads: e.target.value ? Number(e.target.value) : null })} className="h-8 text-sm" />
            </div>
            <div className="space-y-1 w-28">
              <Label className="text-xs">CPL alvo (R$)</Label>
              <Input value={reaisFromCents(activePlan.target_cpl_cents)} onChange={e => onPatch({ target_cpl_cents: centsFromInput(e.target.value) })} className="h-8 text-sm" />
            </div>
            <div className="space-y-1 w-24">
              <Label className="text-xs">ROAS meta</Label>
              <Input value={activePlan.target_roas ?? ''} onChange={e => onPatch({ target_roas: e.target.value ? Number(e.target.value) : null })} className="h-8 text-sm" />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Distribuição de budget entre plataformas</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(PLATFORM_LABEL) as MediaPlanPlatform[]).map(p => (
                <div key={p} className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground w-16 shrink-0">{PLATFORM_LABEL[p]}</span>
                  <Input
                    value={reaisFromCents(activePlan.platform_budgets[p])}
                    onChange={e => onPatch({ platform_budgets: { ...activePlan.platform_budgets, [p]: centsFromInput(e.target.value) ?? 0 } })}
                    className="h-7 text-xs w-24"
                    placeholder="R$"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1 max-w-xl">
            <Label className="text-xs">Observações</Label>
            <Textarea value={activePlan.notes ?? ''} onChange={e => onPatch({ notes: e.target.value })} className="text-sm min-h-[60px]" />
          </div>

          <Button size="sm" onClick={onSave} disabled={isPending}>
            {isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null} Salvar plano
          </Button>
        </CardContent>
      )}
    </Card>
  )
}
