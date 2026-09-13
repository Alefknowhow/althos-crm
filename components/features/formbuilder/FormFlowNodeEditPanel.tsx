'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2, X } from 'lucide-react'
import type { FormField } from '../PublicFormSchema'
import { FIELD_TYPES } from './FieldTypeMeta'

const CHOICE_TYPES = new Set(['single_choice', 'select', 'multi_select'])

/** Editor de pergunta direto no node do canvas — texto, tipo e opções de
 *  resposta, sem precisar fechar o fluxo e voltar pra lista de páginas. */
export default function FormFlowNodeEditPanel({
  field, onChange, onClose,
}: {
  field: FormField
  onChange: (patch: Partial<FormField>) => void
  onClose: () => void
}) {
  const isChoice = CHOICE_TYPES.has(field.type)
  const options = field.options || []

  function updateOption(i: number, value: string) {
    onChange({ options: options.map((o, j) => j === i ? value : o) })
  }
  function addOption() {
    onChange({ options: [...options, `Opção ${options.length + 1}`] })
  }
  function removeOption(i: number) {
    onChange({ options: options.filter((_, j) => j !== i) })
  }

  return (
    <div className="absolute top-3 left-3 z-10 w-72 rounded-md border bg-card shadow-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Pergunta</p>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Texto da pergunta</Label>
        <Input
          className="h-8 text-xs"
          value={field.label}
          onChange={e => onChange({ label: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Tipo</Label>
        <Select value={field.type} onValueChange={v => onChange({ type: v as FormField['type'] })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {FIELD_TYPES.map(t => (
              <SelectItem key={t.type} value={t.type} className="text-xs">{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isChoice && (
        <div className="space-y-1.5">
          <Label className="text-xs">Opções de resposta</Label>
          <div className="space-y-1">
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-1">
                <Input className="h-8 text-xs flex-1" value={opt} onChange={e => updateOption(i, e.target.value)} />
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10 shrink-0" onClick={() => removeOption(i)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs w-full" onClick={addOption}>
            <Plus className="w-3 h-3 mr-1" /> Adicionar opção
          </Button>
        </div>
      )}
    </div>
  )
}
