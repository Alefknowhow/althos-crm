'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Accordion } from '@/components/ui/accordion'
import { Plus, CheckCircle2, Layers, Loader2 } from 'lucide-react'
import {
  createMediaPlan, updateMediaPlan, approveMediaPlan, getMediaPlanWithItems,
  createMediaPlanItem, updateMediaPlanItem, deleteMediaPlanItem,
  type MediaPlan, type MediaPlanItem, type MediaPlanLevel, type MediaPlanPlatform,
} from '@/actions/media-plans'
import MediaPlanItemNode from '@/components/features/agencias-trafego/MediaPlanItemNode'
import { PLATFORM_LABEL, LEVEL_LABEL, centsFromInput, reaisFromCents, type MediaPlanCreative } from '@/components/features/agencias-trafego/media-plan-shared'

/**
 * Estratégia estruturada — plano de mídia versionado + árvore
 * Campanha→Conjunto→Anúncio, editável, base pra futura publicação via API
 * (Meta/Google/etc.) e pro Marketing Strategist (IA). Ver actions/media-plans.ts
 * e MediaPlanItemNode.tsx (o nó recursivo da árvore).
 */
export default function MediaPlanBuilder({
  orgSlug, contatoId, plans: initialPlans, initialItems, creatives,
}: {
  orgSlug: string
  contatoId: string
  plans: MediaPlan[]
  initialItems: MediaPlanItem[]
  creatives: MediaPlanCreative[]
}) {
  const [plans, setPlans] = useState(initialPlans)
  const [activePlanId, setActivePlanId] = useState<string | null>(plans[0]?.id ?? null)
  const [items, setItems] = useState<MediaPlanItem[]>(initialItems)
  const [isPending, startTransition] = useTransition()

  const activePlan = plans.find(p => p.id === activePlanId) || null

  function handleCreatePlan() {
    startTransition(async () => {
      const res = await createMediaPlan(orgSlug, contatoId, { name: `Plano de mídia v${plans.length + 1}` })
      if (!res.ok) { toast.error(res.error); return }
      setPlans(prev => [{
        id: res.id, name: `Plano de mídia v${plans.length + 1}`, version: plans.length + 1, status: 'draft',
        objective_primary: null, objectives_secondary: null, period_start: null, period_end: null,
        budget_total_cents: null, target_leads: null, target_cpl_cents: null, target_cac_cents: null,
        target_roas: null, notes: null, platform_budgets: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }, ...prev])
      setActivePlanId(res.id)
      setItems([])
      toast.success('Novo plano criado')
    })
  }

  function patchPlan(patch: Partial<MediaPlan>) {
    if (!activePlan) return
    setPlans(prev => prev.map(p => p.id === activePlan.id ? { ...p, ...patch } : p))
  }

  function savePlan() {
    if (!activePlan) return
    startTransition(async () => {
      const { id: _id, version: _version, status: _status, created_at: _c, updated_at: _u, ...editable } = activePlan
      const res = await updateMediaPlan(orgSlug, activePlan.id, editable)
      if (!res.ok) { toast.error(res.error); return }
      toast.success('Plano salvo')
    })
  }

  function handleApprove() {
    if (!activePlan) return
    startTransition(async () => {
      const res = await approveMediaPlan(orgSlug, activePlan.id)
      if (!res.ok) { toast.error(res.error); return }
      patchPlan({ status: 'approved' })
      toast.success('Plano aprovado')
    })
  }

  function switchPlan(planId: string) {
    setActivePlanId(planId)
    if (planId === initialPlans[0]?.id) { setItems(initialItems); return }
    startTransition(async () => {
      const res = await getMediaPlanWithItems(orgSlug, planId)
      setItems(res?.items || [])
    })
  }

  function addItem(level: MediaPlanLevel, parentId: string | null, platform: MediaPlanPlatform) {
    if (!activePlan) return
    startTransition(async () => {
      const orderIndex = items.filter(i => i.parent_id === parentId).length
      const res = await createMediaPlanItem(orgSlug, {
        media_plan_id: activePlan.id, parent_id: parentId, level, platform,
        name: `Novo ${LEVEL_LABEL[level].toLowerCase()}`, order_index: orderIndex,
      })
      if (!res.ok) { toast.error(res.error); return }
      setItems(prev => [...prev, {
        id: res.id, media_plan_id: activePlan.id, parent_id: parentId, level, platform,
        funnel_stage: null, name: `Novo ${LEVEL_LABEL[level].toLowerCase()}`, objective: null,
        status: 'planned', budget_cents: null, budget_type: null, creative_id: null, config: {},
        order_index: orderIndex,
      }])
    })
  }

  function patchItem(id: string, patch: Partial<MediaPlanItem>) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))
  }

  function saveItem(id: string) {
    const item = items.find(i => i.id === id)
    if (!item) return
    startTransition(async () => {
      const res = await updateMediaPlanItem(orgSlug, id, {
        name: item.name, objective: item.objective, funnel_stage: item.funnel_stage,
        budget_cents: item.budget_cents, budget_type: item.budget_type, creative_id: item.creative_id,
        config: item.config,
      })
      if (!res.ok) toast.error(res.error)
      else toast.success('Salvo')
    })
  }

  function removeItem(id: string) {
    startTransition(async () => {
      const res = await deleteMediaPlanItem(orgSlug, id)
      if (!res.ok) { toast.error(res.error); return }
      setItems(prev => prev.filter(i => i.id !== id && i.parent_id !== id))
    })
  }

  if (plans.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-3">
          <Layers className="w-8 h-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhum plano de mídia criado ainda pra este cliente.</p>
          <Button onClick={handleCreatePlan} disabled={isPending}>
            {isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Plus className="w-4 h-4 mr-1.5" />}
            Criar plano de mídia
          </Button>
        </CardContent>
      </Card>
    )
  }

  const campaigns = items.filter(i => i.level === 'campaign' && i.media_plan_id === activePlanId)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-sm">Plano de mídia</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={activePlanId ?? undefined} onValueChange={switchPlan}>
              <SelectTrigger className="h-8 text-xs w-48"><SelectValue placeholder="Selecionar plano" /></SelectTrigger>
              <SelectContent>
                {plans.map(p => (
                  <SelectItem key={p.id} value={p.id}>v{p.version} — {p.status === 'approved' ? 'Aprovado' : p.status === 'archived' ? 'Arquivado' : 'Rascunho'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={handleCreatePlan} disabled={isPending}>
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
                <Button size="sm" variant="outline" onClick={handleApprove} disabled={isPending}>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Aprovar
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome do plano</Label>
                <Input value={activePlan.name} onChange={e => patchPlan({ name: e.target.value })} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Objetivo principal</Label>
                <Input value={activePlan.objective_primary ?? ''} onChange={e => patchPlan({ objective_primary: e.target.value })} className="h-8 text-sm" placeholder="Ex.: gerar leads qualificados" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Período início</Label>
                <Input type="date" value={activePlan.period_start ?? ''} onChange={e => patchPlan({ period_start: e.target.value })} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Período fim</Label>
                <Input type="date" value={activePlan.period_end ?? ''} onChange={e => patchPlan({ period_end: e.target.value })} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Orçamento total (R$)</Label>
                <Input value={reaisFromCents(activePlan.budget_total_cents)} onChange={e => patchPlan({ budget_total_cents: centsFromInput(e.target.value) })} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Meta de leads</Label>
                <Input value={activePlan.target_leads ?? ''} onChange={e => patchPlan({ target_leads: e.target.value ? Number(e.target.value) : null })} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">CPL alvo (R$)</Label>
                <Input value={reaisFromCents(activePlan.target_cpl_cents)} onChange={e => patchPlan({ target_cpl_cents: centsFromInput(e.target.value) })} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">ROAS/meta comercial</Label>
                <Input value={activePlan.target_roas ?? ''} onChange={e => patchPlan({ target_roas: e.target.value ? Number(e.target.value) : null })} className="h-8 text-sm" />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Distribuição de budget entre plataformas</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {(Object.keys(PLATFORM_LABEL) as MediaPlanPlatform[]).map(p => (
                  <div key={p} className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground w-20 shrink-0">{PLATFORM_LABEL[p]}</span>
                    <Input
                      value={reaisFromCents(activePlan.platform_budgets[p])}
                      onChange={e => patchPlan({ platform_budgets: { ...activePlan.platform_budgets, [p]: centsFromInput(e.target.value) ?? 0 } })}
                      className="h-7 text-xs"
                      placeholder="R$"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Observações</Label>
              <Textarea value={activePlan.notes ?? ''} onChange={e => patchPlan({ notes: e.target.value })} className="text-sm min-h-[70px]" />
            </div>

            <Button size="sm" onClick={savePlan} disabled={isPending}>
              {isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null} Salvar plano
            </Button>
          </CardContent>
        )}
      </Card>

      {activePlan && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Estrutura de campanhas</CardTitle>
            <Select onValueChange={v => addItem('campaign', null, v as MediaPlanPlatform)}>
              <SelectTrigger className="h-8 text-xs w-40"><SelectValue placeholder="+ Campanha" /></SelectTrigger>
              <SelectContent>
                {(Object.keys(PLATFORM_LABEL) as MediaPlanPlatform[]).map(p => (
                  <SelectItem key={p} value={p}>{PLATFORM_LABEL[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {campaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma campanha estruturada ainda.</p>
            ) : (
              <Accordion type="multiple" className="w-full">
                {campaigns.map(campaign => (
                  <MediaPlanItemNode
                    key={campaign.id}
                    item={campaign}
                    items={items}
                    creatives={creatives}
                    onPatch={patchItem}
                    onSave={saveItem}
                    onRemove={removeItem}
                    onAddChild={addItem}
                    isPending={isPending}
                  />
                ))}
              </Accordion>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
