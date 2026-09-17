'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { Trash2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { MediaPlanItem, MediaPlanLevel, MediaPlanPlatform, MediaPlanFunnelStage, MediaPlanBudgetType } from '@/actions/media-plans'
import {
  PLATFORM_LABEL, PLATFORM_CONNECTED, LEVEL_LABEL, CHILD_LEVEL,
  centsFromInput, reaisFromCents, type MediaPlanCreative,
} from '@/components/features/agencias-trafego/media-plan-shared'

type NodeProps = {
  item: MediaPlanItem
  items: MediaPlanItem[]
  creatives: MediaPlanCreative[]
  onPatch: (id: string, patch: Partial<MediaPlanItem>) => void
  onSave: (id: string) => void
  onRemove: (id: string) => void
  onAddChild: (level: MediaPlanLevel, parentId: string, platform: MediaPlanPlatform) => void
  isPending: boolean
}

/** Um nó (campanha/conjunto/anúncio) da árvore do plano de mídia — recursivo. */
export default function MediaPlanItemNode({ item, items, creatives, onPatch, onSave, onRemove, onAddChild, isPending }: NodeProps) {
  const childLevel = CHILD_LEVEL[item.level]
  const children = items.filter(i => i.parent_id === item.id)
  const connected = PLATFORM_CONNECTED[item.platform]

  return (
    <AccordionItem value={item.id}>
      <AccordionTrigger className="text-sm">
        <span className="flex items-center gap-2 flex-1 text-left">
          <Badge variant="outline" className="text-[10px]">{LEVEL_LABEL[item.level]}</Badge>
          <span className="font-medium">{item.name}</span>
          <Badge variant="outline" className="text-[10px]">{PLATFORM_LABEL[item.platform]}</Badge>
          {!connected && <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-800 border-amber-200">Não conectada</Badge>}
          {item.budget_cents != null && <span className="text-xs text-muted-foreground ml-auto mr-2">{formatCurrency(item.budget_cents)}</span>}
        </span>
      </AccordionTrigger>
      <AccordionContent>
        <div className="pl-3 border-l-2 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Nome</Label>
              <Input value={item.name} onChange={e => onPatch(item.id, { name: e.target.value })} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Objetivo</Label>
              <Input value={item.objective ?? ''} onChange={e => onPatch(item.id, { objective: e.target.value })} className="h-8 text-sm" />
            </div>
            {item.level === 'campaign' && item.platform === 'meta' && (
              <div className="space-y-1">
                <Label className="text-xs">Etapa do funil</Label>
                <Select value={item.funnel_stage ?? undefined} onValueChange={v => onPatch(item.id, { funnel_stage: v as MediaPlanFunnelStage })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Topo/Meio/Fundo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="topo">Topo</SelectItem>
                    <SelectItem value="meio">Meio</SelectItem>
                    <SelectItem value="fundo">Fundo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {item.level !== 'ad' && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">Orçamento (R$)</Label>
                  <Input value={reaisFromCents(item.budget_cents)} onChange={e => onPatch(item.id, { budget_cents: centsFromInput(e.target.value) })} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tipo de orçamento</Label>
                  <Select value={item.budget_type ?? undefined} onValueChange={v => onPatch(item.id, { budget_type: v as MediaPlanBudgetType })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Diário/Vitalício" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Diário</SelectItem>
                      <SelectItem value="lifetime">Vitalício</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>

          <PlatformConfigFields item={item} onPatch={onPatch} />

          {item.level === 'ad' && (
            <div className="space-y-1">
              <Label className="text-xs">Criativo (biblioteca do cliente)</Label>
              <Select value={item.creative_id ?? undefined} onValueChange={v => onPatch(item.id, { creative_id: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar criativo" /></SelectTrigger>
                <SelectContent>
                  {creatives.length === 0
                    ? <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum criativo na biblioteca ainda</div>
                    : creatives.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => onSave(item.id)} disabled={isPending}>Salvar</Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onRemove(item.id)} disabled={isPending}>
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Remover
            </Button>
            {childLevel && (
              <Select onValueChange={v => onAddChild(childLevel, item.id, v as MediaPlanPlatform)}>
                <SelectTrigger className="h-8 text-xs w-40 ml-auto"><SelectValue placeholder={`+ ${LEVEL_LABEL[childLevel]}`} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={item.platform}>{PLATFORM_LABEL[item.platform]} (mesma)</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {children.length > 0 && (
            <Accordion type="multiple" className="w-full">
              {children.map(child => (
                <MediaPlanItemNode key={child.id} item={child} items={items} creatives={creatives} onPatch={onPatch} onSave={onSave} onRemove={onRemove} onAddChild={onAddChild} isPending={isPending} />
              ))}
            </Accordion>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}

function PlatformConfigFields({ item, onPatch }: { item: MediaPlanItem; onPatch: (id: string, patch: Partial<MediaPlanItem>) => void }) {
  const cfg = item.config || {}
  function setCfg(key: string, value: string) {
    onPatch(item.id, { config: { ...cfg, [key]: value } })
  }

  if (item.level === 'campaign' && item.platform === 'meta') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <ConfigInput label="Estratégia de lance" value={cfg.bid_strategy} onChange={v => setCfg('bid_strategy', v)} />
        <ConfigInput label="Evento de otimização" value={cfg.optimization_event} onChange={v => setCfg('optimization_event', v)} />
        <ConfigInput label="Objetivo de conversão" value={cfg.conversion_objective} onChange={v => setCfg('conversion_objective', v)} />
      </div>
    )
  }
  if (item.level === 'adset' && item.platform === 'meta') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <ConfigInput label="Localização" value={cfg.location} onChange={v => setCfg('location', v)} />
        <ConfigInput label="Idade" value={cfg.age_range} onChange={v => setCfg('age_range', v)} />
        <ConfigInput label="Gênero" value={cfg.gender} onChange={v => setCfg('gender', v)} />
        <ConfigInput label="Interesses" value={cfg.interests} onChange={v => setCfg('interests', v)} />
        <ConfigInput label="Custom audiences" value={cfg.custom_audiences} onChange={v => setCfg('custom_audiences', v)} />
        <ConfigInput label="Lookalikes" value={cfg.lookalikes} onChange={v => setCfg('lookalikes', v)} />
        <ConfigInput label="Exclusões" value={cfg.exclusions} onChange={v => setCfg('exclusions', v)} />
        <ConfigInput label="Posicionamentos" value={cfg.placements} onChange={v => setCfg('placements', v)} />
      </div>
    )
  }
  if (item.level === 'campaign' && item.platform === 'google') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <ConfigInput label="Tipo de campanha" value={cfg.campaign_type} onChange={v => setCfg('campaign_type', v)} placeholder="Search/Display/PMax/YouTube" />
        <ConfigInput label="Rede" value={cfg.network} onChange={v => setCfg('network', v)} />
        <ConfigInput label="Estratégia de lance" value={cfg.bid_strategy} onChange={v => setCfg('bid_strategy', v)} />
        <ConfigInput label="Localização" value={cfg.location} onChange={v => setCfg('location', v)} />
      </div>
    )
  }
  if (item.level === 'adset' && item.platform === 'google') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <ConfigInput label="Palavras-chave" value={cfg.keywords} onChange={v => setCfg('keywords', v)} />
        <ConfigInput label="Palavras-chave negativas" value={cfg.negative_keywords} onChange={v => setCfg('negative_keywords', v)} />
        <ConfigInput label="Tipos de correspondência" value={cfg.match_types} onChange={v => setCfg('match_types', v)} />
      </div>
    )
  }
  if (item.level === 'ad') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <ConfigInput label="Formato" value={cfg.format} onChange={v => setCfg('format', v)} />
        <ConfigInput label="Headline" value={cfg.headline} onChange={v => setCfg('headline', v)} />
        <ConfigInput label="Descrição" value={cfg.description} onChange={v => setCfg('description', v)} />
        <ConfigInput label="CTA" value={cfg.cta} onChange={v => setCfg('cta', v)} />
        <ConfigInput label="URL de destino" value={cfg.url} onChange={v => setCfg('url', v)} />
        <ConfigInput label="UTMs" value={cfg.utms} onChange={v => setCfg('utms', v)} />
        <div className="md:col-span-2 space-y-1">
          <Label className="text-xs">Copy</Label>
          <Textarea value={(cfg.copy as string) ?? ''} onChange={e => setCfg('copy', e.target.value)} className="text-sm min-h-[60px]" />
        </div>
      </div>
    )
  }
  // TikTok/LinkedIn/GPT Ads e outros níveis não cobertos por schema específico ainda.
  return (
    <p className="text-xs text-muted-foreground">
      Campos específicos de {PLATFORM_LABEL[item.platform]} pra este nível ainda não têm schema próprio — use Objetivo/Observações por enquanto.
    </p>
  )
}

function ConfigInput({ label, value, onChange, placeholder }: { label: string; value: unknown; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input value={typeof value === 'string' ? value : ''} onChange={e => onChange(e.target.value)} className="h-8 text-sm" placeholder={placeholder} />
    </div>
  )
}
