'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { nicheKeyFor } from '@/lib/niche'
import { visibleTriggerTypes } from '@/lib/automations/trigger-meta'
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
          onChange={e => setAuto({ ...auto, trigger_type: e.target.value, trigger_config: {} })}
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
