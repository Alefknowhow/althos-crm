'use client'

/**
 * Builder de regras do step "Condição (SE)" — grupos combinados por OU,
 * regras dentro de um grupo combinadas por E (ver lib/automations/
 * condition-fields.ts). A ramificação verdadeiro/falso em si é configurada
 * nas CONEXÕES que saem deste passo (AutomationFlowEdgePanel), não aqui —
 * este painel só edita as regras que decidem o resultado.
 */

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, X } from 'lucide-react'
import { CONDITION_FIELDS, OPERATORS_BY_TYPE, conditionFieldMeta, type ConditionGroup, type ConditionRule } from '@/lib/automations/condition-fields'
import type { Step } from './AutomationFlowMeta'

function emptyRule(): ConditionRule {
  return { field: CONDITION_FIELDS[0].key, operator: 'equals', value: '' }
}

export function ConditionRulesFields({ step, patch }: { step: Step; patch: (u: Record<string, any>) => void }) {
  const groups: ConditionGroup[] = step.config.groups?.length ? step.config.groups : [{ rules: [emptyRule()] }]

  function setGroups(next: ConditionGroup[]) {
    patch({ groups: next })
  }

  function updateRule(gi: number, ri: number, u: Partial<ConditionRule>) {
    const next = groups.map((g, i) => i !== gi ? g : { rules: g.rules.map((r, j) => j !== ri ? r : { ...r, ...u }) })
    setGroups(next)
  }

  function addRule(gi: number) {
    setGroups(groups.map((g, i) => i !== gi ? g : { rules: [...g.rules, emptyRule()] }))
  }

  function removeRule(gi: number, ri: number) {
    const next = groups.map((g, i) => i !== gi ? g : { rules: g.rules.filter((_, j) => j !== ri) })
    setGroups(next.filter(g => g.rules.length > 0))
  }

  function addGroup() {
    setGroups([...groups, { rules: [emptyRule()] }])
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Passa quando <b>todas</b> as regras de <b>um</b> dos grupos abaixo forem verdadeiras. Sem nenhuma regra, a condição sempre passa.
      </p>

      {groups.map((group, gi) => (
        <div key={gi} className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-2.5">
          {gi > 0 && <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">OU</p>}
          {group.rules.map((rule, ri) => {
            const meta = conditionFieldMeta(rule.field)
            const ops = OPERATORS_BY_TYPE[meta?.type || 'text']
            const needsValue = rule.operator !== 'is_empty' && rule.operator !== 'not_empty'
            return (
              <div key={ri} className="flex items-center gap-1.5">
                {ri > 0 && <span className="w-6 shrink-0 text-[10px] font-semibold text-muted-foreground">E</span>}
                <Select value={rule.field} onValueChange={v => updateRule(gi, ri, { field: v, operator: 'equals', value: '' })}>
                  <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONDITION_FIELDS.map(f => <SelectItem key={f.key} value={f.key} className="text-xs">{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={rule.operator} onValueChange={v => updateRule(gi, ri, { operator: v as ConditionRule['operator'] })}>
                  <SelectTrigger className="h-8 text-xs w-36 shrink-0"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ops.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {needsValue && (
                  meta?.type === 'select' && meta.options ? (
                    <Select value={rule.value || ''} onValueChange={v => updateRule(gi, ri, { value: v })}>
                      <SelectTrigger className="h-8 text-xs w-32 shrink-0"><SelectValue placeholder="Valor" /></SelectTrigger>
                      <SelectContent>
                        {meta.options.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input className="h-8 text-xs w-28 shrink-0" placeholder="Valor" value={rule.value || ''}
                      onChange={e => updateRule(gi, ri, { value: e.target.value })} />
                  )
                )}
                <button type="button" onClick={() => removeRule(gi, ri)} className="shrink-0 text-muted-foreground hover:text-destructive" aria-label="Remover regra">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}
          <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => addRule(gi)}>
            <Plus className="w-3 h-3 mr-1" /> Regra (E)
          </Button>
        </div>
      ))}

      <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={addGroup}>
        <Plus className="w-3 h-3 mr-1" /> Grupo (OU)
      </Button>
    </div>
  )
}
