'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectContent, SelectItem } from '@/components/ui/select'
import { Plus, Layers, Loader2 } from 'lucide-react'
import {
  createMediaPlan, updateMediaPlan, approveMediaPlan, getMediaPlanWithItems,
  createMediaPlanItem, updateMediaPlanItem, deleteMediaPlanItem,
  type MediaPlan, type MediaPlanItem, type MediaPlanLevel, type MediaPlanPlatform,
} from '@/actions/media-plans'
import { MediaPlanItemRow, MediaPlanItemEditForm } from '@/components/features/agencias-trafego/MediaPlanItemNode'
import MediaPlanMetaCard from '@/components/features/agencias-trafego/MediaPlanMetaCard'
import {
  PLATFORM_LABEL, LEVEL_LABEL, PLATFORM_HAS_ADSET_LEVEL, PLATFORM_ADSET_LABEL, type MediaPlanCreative,
} from '@/components/features/agencias-trafego/media-plan-shared'

/**
 * Estratégia estruturada — plano de mídia versionado + árvore Campanha→
 * Grupo→Anúncio em colunas lado a lado (Miller columns: selecionar uma
 * campanha mostra o nível do meio na coluna 2, selecionar esse item mostra
 * os anúncios na coluna 3). A estrutura real varia por plataforma — Meta/
 * Google/TikTok/GPT Ads têm os 3 níveis, LinkedIn Ads não tem nível de
 * conjunto/grupo (segmentação fica na campanha, anúncio pendura direto
 * nela) — ver PLATFORM_HAS_ADSET_LEVEL em media-plan-shared.ts. Base pra
 * futura publicação via API e pro Marketing Strategist (IA). Ver
 * actions/media-plans.ts e MediaPlanItemNode.tsx (linha/formulário de um item).
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
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)
  const [selectedAdsetId, setSelectedAdsetId] = useState<string | null>(null)
  const [selectedAdId, setSelectedAdId] = useState<string | null>(null)
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
      setSelectedCampaignId(null); setSelectedAdsetId(null); setSelectedAdId(null)
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
    setSelectedCampaignId(null); setSelectedAdsetId(null); setSelectedAdId(null)
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
        status: 'planned', budget_cents: null, budget_type: null, creative_id: null, library_asset_id: null, config: {},
        order_index: orderIndex,
      }])
      // Cria e já seleciona — ao criar uma campanha, a coluna de conjuntos
      // abre imediatamente pronta pro próximo passo (pedido explícito pra
      // Meta Ads, aplicado a qualquer plataforma por consistência).
      if (level === 'campaign') { setSelectedCampaignId(res.id); setSelectedAdsetId(null); setSelectedAdId(null) }
      else if (level === 'adset') { setSelectedAdsetId(res.id); setSelectedAdId(null) }
      else setSelectedAdId(res.id)
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
        budget_cents: item.budget_cents, budget_type: item.budget_type, library_asset_id: item.library_asset_id,
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
      if (selectedCampaignId === id) { setSelectedCampaignId(null); setSelectedAdsetId(null); setSelectedAdId(null) }
      else if (selectedAdsetId === id) { setSelectedAdsetId(null); setSelectedAdId(null) }
      else if (selectedAdId === id) setSelectedAdId(null)
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
  const adsets = selectedCampaignId ? items.filter(i => i.parent_id === selectedCampaignId) : []
  const selectedCampaign = items.find(i => i.id === selectedCampaignId) || null
  const selectedAdset = items.find(i => i.id === selectedAdsetId) || null
  const selectedAd = items.find(i => i.id === selectedAdId) || null

  // LinkedIn Ads não tem nível de conjunto/grupo — a segmentação mora na
  // própria campanha e o anúncio pendura direto nela. Pra qualquer outra
  // plataforma, o anúncio pendura no conjunto/grupo selecionado, como
  // sempre. `adParentId` é quem realmente vira `parent_id` do anúncio.
  const hasAdsetLevel = selectedCampaign ? PLATFORM_HAS_ADSET_LEVEL[selectedCampaign.platform] : true
  const adParent = hasAdsetLevel ? selectedAdset : selectedCampaign
  const ads = adParent ? items.filter(i => i.parent_id === adParent.id) : []
  const adsetColumnLabel = selectedCampaign ? PLATFORM_ADSET_LABEL[selectedCampaign.platform] : 'Conjuntos'

  return (
    <div className="space-y-4">
      <MediaPlanMetaCard
        plans={plans}
        activePlan={activePlan}
        activePlanId={activePlanId}
        isPending={isPending}
        onSwitchPlan={switchPlan}
        onCreatePlan={handleCreatePlan}
        onPatch={patchPlan}
        onSave={savePlan}
        onApprove={handleApprove}
      />

      {activePlan && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          {/* Coluna 1 — Campanhas */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 py-3">
              <CardTitle className="text-sm">Campanhas</CardTitle>
              <Select onValueChange={v => addItem('campaign', null, v as MediaPlanPlatform)}>
                <SelectTrigger className="h-7 text-xs w-9 px-0 justify-center [&>svg]:hidden"><Plus className="w-3.5 h-3.5" /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PLATFORM_LABEL) as MediaPlanPlatform[]).map(p => (
                    <SelectItem key={p} value={p}>{PLATFORM_LABEL[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="space-y-1">
              {campaigns.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma campanha ainda.</p>
              ) : campaigns.map(c => (
                <div key={c.id}>
                  <MediaPlanItemRow
                    item={c}
                    selected={c.id === selectedCampaignId}
                    onSelect={() => { setSelectedCampaignId(c.id); setSelectedAdsetId(null); setSelectedAdId(null) }}
                  />
                  {c.id === selectedCampaignId && (
                    <div className="mt-1">
                      <MediaPlanItemEditForm item={c} creatives={creatives} onPatch={patchItem} onSave={saveItem} onRemove={removeItem} isPending={isPending} />
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Coluna 2 — Conjuntos/Grupos (label e existência do nível variam
              por plataforma — ver PLATFORM_HAS_ADSET_LEVEL). */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 py-3">
              <CardTitle className="text-sm">{adsetColumnLabel}</CardTitle>
              {selectedCampaign && hasAdsetLevel && (
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => addItem('adset', selectedCampaign.id, selectedCampaign.platform)}>
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-1">
              {!selectedCampaign ? (
                <p className="text-xs text-muted-foreground py-4 text-center">Selecione uma campanha.</p>
              ) : !hasAdsetLevel ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  {PLATFORM_LABEL[selectedCampaign.platform]} não usa este nível — a segmentação de público fica na própria campanha.
                </p>
              ) : adsets.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">Nenhum conjunto ainda.</p>
              ) : adsets.map(a => (
                <div key={a.id}>
                  <MediaPlanItemRow
                    item={a}
                    selected={a.id === selectedAdsetId}
                    onSelect={() => { setSelectedAdsetId(a.id); setSelectedAdId(null) }}
                  />
                  {a.id === selectedAdsetId && (
                    <div className="mt-1">
                      <MediaPlanItemEditForm item={a} creatives={creatives} onPatch={patchItem} onSave={saveItem} onRemove={removeItem} isPending={isPending} />
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Coluna 3 — Anúncios */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 py-3">
              <CardTitle className="text-sm">Anúncios</CardTitle>
              {adParent && (
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => addItem('ad', adParent.id, adParent.platform)}>
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-1">
              {!adParent ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  {hasAdsetLevel || !selectedCampaign ? 'Selecione um conjunto.' : 'Selecione a campanha.'}
                </p>
              ) : ads.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">Nenhum anúncio ainda.</p>
              ) : ads.map(ad => (
                <div key={ad.id}>
                  <MediaPlanItemRow item={ad} selected={ad.id === selectedAdId} onSelect={() => setSelectedAdId(ad.id)} />
                  {ad.id === selectedAdId && (
                    <div className="mt-1">
                      <MediaPlanItemEditForm item={selectedAd ?? ad} creatives={creatives} onPatch={patchItem} onSave={saveItem} onRemove={removeItem} isPending={isPending} />
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
