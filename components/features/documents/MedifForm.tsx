'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { MEDIF_SECTIONS, type MedifField } from '@/lib/medif/schema'

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background'

function YesNoToggle({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1.5">
      {['Sim', 'Não'].map(opt => {
        const active = value === opt
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(active ? '' : opt)}
            className={cn(
              'px-3 h-8 rounded-lg border text-xs font-medium transition-colors',
              FOCUS_RING,
              active
                ? opt === 'Sim' ? 'bg-success/15 text-success border-success/30' : 'bg-muted text-foreground border-border'
                : 'bg-background hover:bg-muted text-muted-foreground border-border',
            )}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}

function FieldInput({ field, value, onChange }: { field: MedifField; value: string; onChange: (v: string) => void }) {
  switch (field.type) {
    case 'yesno':
      return <YesNoToggle value={value} onChange={onChange} />
    case 'select':
      return (
        <Select value={value || undefined} onValueChange={onChange}>
          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            {(field.options || []).map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
          </SelectContent>
        </Select>
      )
    case 'textarea':
      return <Textarea rows={2} value={value} onChange={e => onChange(e.target.value)} />
    case 'date':
      return <Input type="date" value={value} onChange={e => onChange(e.target.value)} />
    case 'number':
      return <Input type="number" value={value} onChange={e => onChange(e.target.value)} />
    default:
      return <Input value={value} onChange={e => onChange(e.target.value)} />
  }
}

export default function MedifForm({
  data, onChange,
}: {
  data: Record<string, string>
  onChange: (key: string, value: string) => void
}) {
  return (
    <div className="space-y-4">
      {MEDIF_SECTIONS.map(section => (
        <div key={section.key} className="rounded-lg border bg-muted/20 p-3 space-y-2.5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{section.title}</p>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {section.fields.map(field => (
              <div key={field.key} className="space-y-1">
                <Label className="text-xs text-muted-foreground">{field.label}</Label>
                <FieldInput field={field} value={data[field.key] || ''} onChange={v => onChange(field.key, v)} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
