'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { X } from 'lucide-react'
import type { FormField } from '../PublicFormSchema'
import type { FlowCondition, FlowOperator } from '@/lib/forms/flow-traversal'

const OPERATOR_OPTIONS: { value: FlowOperator; label: string }[] = [
  { value: 'eq', label: 'é igual a' },
  { value: 'neq', label: 'é diferente de' },
  { value: 'contains', label: 'contém' },
  { value: 'not_contains', label: 'não contém' },
  { value: 'is_filled', label: 'foi respondida' },
  { value: 'is_empty', label: 'não foi respondida' },
]

const NEEDS_VALUE = new Set<FlowOperator>(['eq', 'neq', 'contains', 'not_contains'])

/** Painel de edição de uma edge selecionada — condição (baseada na
 *  resposta do campo de origem) ou "caminho padrão" (sem condição, usado
 *  quando nenhuma outra condição daquele node bate). */
export default function FormFlowConditionPanel({
  sourceField, condition, onChange, onRemoveEdge, onClose,
}: {
  /** Campo de origem da edge — null quando a edge sai de 'welcome' (sem
   *  resposta pra comparar, então só existe caminho padrão). */
  sourceField: FormField | null
  condition: FlowCondition | undefined
  onChange: (condition: FlowCondition | undefined) => void
  onRemoveEdge: () => void
  onClose: () => void
}) {
  const isDefault = !condition

  return (
    <div className="absolute top-3 right-3 z-10 w-72 rounded-md border bg-card shadow-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Conexão</p>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      {!sourceField ? (
        <p className="text-xs text-muted-foreground">
          Conexões saindo do início não têm condição — é sempre o caminho padrão.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={isDefault ? 'default' : 'outline'}
              className="text-xs h-7"
              onClick={() => onChange(undefined)}
            >
              Caminho padrão
            </Button>
            <Button
              type="button"
              size="sm"
              variant={!isDefault ? 'default' : 'outline'}
              className="text-xs h-7"
              onClick={() => onChange({ fieldId: sourceField.id, operator: 'eq', value: '' })}
            >
              Com condição
            </Button>
          </div>

          {!isDefault && condition && (
            <div className="space-y-2 pt-1">
              <p className="text-xs text-muted-foreground">
                Se a resposta de <span className="font-medium text-foreground">{sourceField.label}</span>...
              </p>
              <Select value={condition.operator} onValueChange={v => onChange({ ...condition, operator: v as FlowOperator })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OPERATOR_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {NEEDS_VALUE.has(condition.operator) && (
                sourceField.options?.length ? (
                  <Select value={condition.value || ''} onValueChange={v => onChange({ ...condition, value: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Escolha uma opção" /></SelectTrigger>
                    <SelectContent>
                      {sourceField.options.map(opt => (
                        <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    className="h-8 text-xs"
                    placeholder="Valor de comparação"
                    value={condition.value || ''}
                    onChange={e => onChange({ ...condition, value: e.target.value })}
                  />
                )
              )}
            </div>
          )}
        </>
      )}

      <div className="pt-1 border-t">
        <Button type="button" size="sm" variant="ghost" className="text-xs h-7 text-destructive hover:text-destructive w-full" onClick={onRemoveEdge}>
          Remover conexão
        </Button>
      </div>
    </div>
  )
}
