'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Trash2 } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import type { MediaPlanItem, MediaPlanPlatform, MediaPlanFunnelStage, MediaPlanBudgetType } from '@/actions/media-plans'
import {
  PLATFORM_LABEL, PLATFORM_CONNECTED, centsFromInput, reaisFromCents, type MediaPlanCreative,
} from '@/components/features/agencias-trafego/media-plan-shared'

/** Linha compacta de um item numa coluna (Campanha/Conjunto/Anúncio) —
 *  clicável pra selecionar. Sem edição inline aqui; o formulário de edição
 *  (MediaPlanItemEditForm) aparece logo abaixo quando `selected`. */
export function MediaPlanItemRow({ item, selected, onSelect }: { item: MediaPlanItem; selected: boolean; onSelect: () => void }) {
  const connected = PLATFORM_CONNECTED[item.platform]
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
        selected ? 'bg-secondary' : 'hover:bg-secondary/60',
      )}
    >
      <span className="font-medium truncate flex-1">{item.name}</span>
      {!connected && <Badge variant="outline" className="text-[10px] shrink-0 bg-amber-100 text-amber-800 border-amber-200">Não conectada</Badge>}
      {item.budget_cents != null && <span className="text-xs text-muted-foreground shrink-0 tabular-nums">{formatCurrency(item.budget_cents)}</span>}
    </button>
  )
}

/** Formulário de edição de UM item (campanha/conjunto/anúncio), sem
 *  accordion e sem recursão — a árvore vira 3 colunas Miller no
 *  MediaPlanBuilder, cada coluna só lista os itens do nível dela. Campos
 *  dimensionados pelo tamanho real do conteúdo (datas/números curtos não
 *  ocupam a largura inteira). */
export function MediaPlanItemEditForm({
  item, creatives, onPatch, onSave, onRemove, isPending,
}: {
  item: MediaPlanItem
  creatives: MediaPlanCreative[]
  onPatch: (id: string, patch: Partial<MediaPlanItem>) => void
  onSave: (id: string) => void
  onRemove: (id: string) => void
  isPending: boolean
}) {
  return (
    <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="space-y-1 flex-1 min-w-[140px]">
          <Label className="text-xs">Nome</Label>
          <Input value={item.name} onChange={e => onPatch(item.id, { name: e.target.value })} className="h-8 text-sm" />
        </div>
        <div className="space-y-1 flex-1 min-w-[140px]">
          <Label className="text-xs">Objetivo</Label>
          <Input value={item.objective ?? ''} onChange={e => onPatch(item.id, { objective: e.target.value })} className="h-8 text-sm" />
        </div>
        {item.level === 'campaign' && item.platform === 'meta' && (
          <div className="space-y-1 w-32 shrink-0">
            <Label className="text-xs">Funil</Label>
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
            <div className="space-y-1 w-28 shrink-0">
              <Label className="text-xs">Orçamento</Label>
              <Input value={reaisFromCents(item.budget_cents)} onChange={e => onPatch(item.id, { budget_cents: centsFromInput(e.target.value) })} className="h-8 text-sm" placeholder="R$" />
            </div>
            <div className="space-y-1 w-28 shrink-0">
              <Label className="text-xs">Tipo</Label>
              <Select value={item.budget_type ?? undefined} onValueChange={v => onPatch(item.id, { budget_type: v as MediaPlanBudgetType })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Diário" /></SelectTrigger>
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
        <div className="space-y-1 max-w-xs">
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
      </div>
    </div>
  )
}

function PlatformConfigFields({ item, onPatch }: { item: MediaPlanItem; onPatch: (id: string, patch: Partial<MediaPlanItem>) => void }) {
  const cfg = item.config || {}
  function setCfg(key: string, value: string) {
    onPatch(item.id, { config: { ...cfg, [key]: value } })
  }

  if (item.level === 'campaign' && item.platform === 'meta') {
    return (
      <div className="flex flex-wrap gap-2">
        <ConfigInput label="Estratégia de lance" value={cfg.bid_strategy} onChange={v => setCfg('bid_strategy', v)} width="w-40" />
        <ConfigInput label="Evento de otimização" value={cfg.optimization_event} onChange={v => setCfg('optimization_event', v)} width="w-44" />
        <ConfigInput label="Objetivo de conversão" value={cfg.conversion_objective} onChange={v => setCfg('conversion_objective', v)} width="w-44" />
      </div>
    )
  }
  if (item.level === 'adset' && item.platform === 'meta') {
    return (
      <div className="flex flex-wrap gap-2">
        <ConfigInput label="Localização" value={cfg.location} onChange={v => setCfg('location', v)} width="w-36" />
        <ConfigInput label="Idade" value={cfg.age_range} onChange={v => setCfg('age_range', v)} width="w-24" placeholder="18-65" />
        <ConfigInput label="Gênero" value={cfg.gender} onChange={v => setCfg('gender', v)} width="w-24" />
        <ConfigInput label="Interesses" value={cfg.interests} onChange={v => setCfg('interests', v)} width="w-52" />
        <ConfigInput label="Custom audiences" value={cfg.custom_audiences} onChange={v => setCfg('custom_audiences', v)} width="w-44" />
        <ConfigInput label="Lookalikes" value={cfg.lookalikes} onChange={v => setCfg('lookalikes', v)} width="w-36" />
        <ConfigInput label="Exclusões" value={cfg.exclusions} onChange={v => setCfg('exclusions', v)} width="w-36" />
        <ConfigInput label="Posicionamentos" value={cfg.placements} onChange={v => setCfg('placements', v)} width="w-44" />
      </div>
    )
  }
  if (item.level === 'campaign' && item.platform === 'google') {
    return (
      <div className="flex flex-wrap gap-2">
        <ConfigInput label="Tipo de campanha" value={cfg.campaign_type} onChange={v => setCfg('campaign_type', v)} placeholder="Search/Display/PMax/YouTube" width="w-52" />
        <ConfigInput label="Rede" value={cfg.network} onChange={v => setCfg('network', v)} width="w-32" />
        <ConfigInput label="Estratégia de lance" value={cfg.bid_strategy} onChange={v => setCfg('bid_strategy', v)} width="w-40" />
        <ConfigInput label="Localização" value={cfg.location} onChange={v => setCfg('location', v)} width="w-36" />
      </div>
    )
  }
  if (item.level === 'adset' && item.platform === 'google') {
    return (
      <div className="flex flex-wrap gap-2">
        <ConfigInput label="Palavras-chave" value={cfg.keywords} onChange={v => setCfg('keywords', v)} width="w-52" />
        <ConfigInput label="Palavras-chave negativas" value={cfg.negative_keywords} onChange={v => setCfg('negative_keywords', v)} width="w-52" />
        <ConfigInput label="Tipos de correspondência" value={cfg.match_types} onChange={v => setCfg('match_types', v)} width="w-44" />
      </div>
    )
  }
  if (item.level === 'ad') {
    return (
      <div className="flex flex-wrap gap-2">
        <ConfigInput label="Formato" value={cfg.format} onChange={v => setCfg('format', v)} width="w-32" />
        <ConfigInput label="Headline" value={cfg.headline} onChange={v => setCfg('headline', v)} width="w-52" />
        <ConfigInput label="Descrição" value={cfg.description} onChange={v => setCfg('description', v)} width="w-52" />
        <ConfigInput label="CTA" value={cfg.cta} onChange={v => setCfg('cta', v)} width="w-32" />
        <ConfigInput label="URL de destino" value={cfg.url} onChange={v => setCfg('url', v)} width="w-52" />
        <ConfigInput label="UTMs" value={cfg.utms} onChange={v => setCfg('utms', v)} width="w-52" />
        <div className="space-y-1 w-full">
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

function ConfigInput({ label, value, onChange, placeholder, width }: { label: string; value: unknown; onChange: (v: string) => void; placeholder?: string; width: string }) {
  return (
    <div className={cn('space-y-1', width)}>
      <Label className="text-xs">{label}</Label>
      <Input value={typeof value === 'string' ? value : ''} onChange={e => onChange(e.target.value)} className="h-8 text-sm" placeholder={placeholder} />
    </div>
  )
}

// Mantido só pra não quebrar imports de tipo em outros arquivos, caso existam.
export type { MediaPlanPlatform }
