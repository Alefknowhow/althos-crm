'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { nicheKeyFor } from '@/lib/niche'
import { visibleTriggerTypes } from '@/lib/automations/trigger-meta'
import { visibleRelativeDateEntities, DEFAULT_RELATIVE_DATE_CONFIG, type RelativeDateTriggerConfig } from '@/lib/automations/relative-date-entities'
import { triggerMeta, type FormOpt, type StageOpt } from './AutomationFlowMeta'

// ── Config panel ───────────────────────────────────────────────────────────────

export function TriggerConfig({ auto, setAuto, forms, stages, niche }: { auto: any; setAuto: (n: any) => void; forms: FormOpt[]; stages: StageOpt[]; niche?: string | null }) {
  // O gatilho atual pode ser de uma vertical diferente do nicho corrente
  // (automação antiga, ou nicho trocado depois) — garante que ele continue
  // listado mesmo fora do filtro, senão o select "perde" o valor selecionado.
  const options = visibleTriggerTypes(nicheKeyFor(niche))
  const current = triggerMeta(auto.trigger_type)
  const selectable = options.some(t => t.id === current.id) ? options : [current, ...options]

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Evento de disparo</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-input/25 px-3 text-sm"
          value={auto.trigger_type}
          onChange={e => setAuto({
            ...auto,
            trigger_type: e.target.value,
            trigger_config: e.target.value === 'date.relative' ? DEFAULT_RELATIVE_DATE_CONFIG : {},
          })}
        >
          {selectable.map(t => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">{current.desc}</p>
      </div>

      {auto.trigger_type === 'form.submitted' && (
        <div className="space-y-2">
          <Label className="text-xs">Formulário</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-input/25 px-3 text-sm"
            value={auto.trigger_config?.formId || ''}
            onChange={e => setAuto({ ...auto, trigger_config: { formId: e.target.value } })}
          >
            <option value="">Qualquer formulário</option>
            {forms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
      )}

      {auto.trigger_type === 'lead.stage_changed' && (
        <div className="space-y-2">
          <Label className="text-xs">Estágio que dispara</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-input/25 px-3 text-sm"
            value={auto.trigger_config?.stageId || ''}
            onChange={e => setAuto({ ...auto, trigger_config: { stageId: e.target.value } })}
          >
            <option value="">Qualquer estágio</option>
            {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}

      {auto.trigger_type === 'lead.tag_added' && (
        <div className="space-y-2">
          <Label className="text-xs">Tag adicionada</Label>
          <Input
            placeholder="Ex: VIP"
            value={auto.trigger_config?.tag || ''}
            onChange={e => setAuto({ ...auto, trigger_config: { tag: e.target.value } })}
          />
        </div>
      )}

      {(auto.trigger_type === 'instagram.dm.received' || auto.trigger_type === 'instagram.comment.received') && (
        <div className="space-y-2">
          <Label className="text-xs">Palavra-chave (opcional)</Label>
          <Input
            placeholder="Ex: orçamento — vazio dispara em qualquer mensagem"
            value={auto.trigger_config?.keyword || ''}
            onChange={e => setAuto({ ...auto, trigger_config: { keyword: e.target.value } })}
          />
        </div>
      )}

      {auto.trigger_type === 'date.relative' && (
        <RelativeDateConfig auto={auto} setAuto={setAuto} niche={niche} />
      )}

      {auto.trigger_type === 'lead.stale' && (
        <div className="space-y-2">
          <Label className="text-xs">Dias sem contato</Label>
          <Input
            type="number" min={1} max={365} placeholder="7"
            value={auto.trigger_config?.staleDays ?? 7}
            onChange={e => setAuto({ ...auto, trigger_config: { staleDays: parseInt(e.target.value) || 7 } })}
          />
        </div>
      )}
    </div>
  )
}

// ── Config do trigger "Data Relativa" (issue #18 §4) ─────────────────────────
// N dias/semanas/meses antes|no momento|depois de um campo de data de uma
// entidade suportada — allowlist em lib/automations/relative-date-entities.ts,
// nunca um campo arbitrário escolhido em texto livre.
function RelativeDateConfig({ auto, setAuto, niche }: { auto: any; setAuto: (n: any) => void; niche?: string | null }) {
  const entities = visibleRelativeDateEntities(nicheKeyFor(niche))
  const cfg: RelativeDateTriggerConfig = { ...DEFAULT_RELATIVE_DATE_CONFIG, ...(auto.trigger_config || {}) }

  function update(patch: Partial<RelativeDateTriggerConfig>) {
    setAuto({ ...auto, trigger_config: { ...cfg, ...patch } })
  }

  return (
    <div className="space-y-3 rounded-md border border-border/60 bg-muted/20 p-3">
      <div className="space-y-2">
        <Label className="text-xs">Campo de data</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-input/25 px-3 text-sm"
          value={cfg.entity}
          onChange={e => update({ entity: e.target.value as RelativeDateTriggerConfig['entity'] })}
        >
          {entities.map(e => <option key={e.key} value={e.key}>{e.label}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-2">
          <Label className="text-xs">Quando</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-input/25 px-3 text-sm"
            value={cfg.direction}
            onChange={e => update({ direction: e.target.value as RelativeDateTriggerConfig['direction'] })}
          >
            <option value="before">Antes</option>
            <option value="on">No momento</option>
            <option value="after">Depois</option>
          </select>
        </div>
        {cfg.direction !== 'on' && (
          <>
            <div className="space-y-2">
              <Label className="text-xs">Quantidade</Label>
              <Input
                type="number" min={1} max={365}
                value={cfg.amount}
                onChange={e => update({ amount: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Unidade</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-input/25 px-3 text-sm"
                value={cfg.unit}
                onChange={e => update({ unit: e.target.value as RelativeDateTriggerConfig['unit'] })}
              >
                <option value="days">Dias</option>
                <option value="weeks">Semanas</option>
                <option value="months">Meses</option>
              </select>
            </div>
          </>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Horário do disparo (fuso de São Paulo)</Label>
        <Input
          type="time"
          value={cfg.timeOfDay}
          onChange={e => update({ timeOfDay: e.target.value || '09:00' })}
        />
        <p className="text-xs text-muted-foreground">
          A verificação roda de hora em hora — o disparo acontece na hora cheia mais próxima do horário escolhido.
        </p>
      </div>
    </div>
  )
}
