'use client'

import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, parseCurrency } from '@/lib/utils'
import type { Member, Stage } from './LeadDataTab'

type Props = {
 tags: string[]; tagDraft: string; onTagDraftChange: (value: string) => void; onAddTag: () => void; onRemoveTag: (tag: string) => void
 value: string; onValueChange: (value: string) => void; onSaveValue: () => void
 stageId?: string | null; stages: Stage[]; onChangeStage: (id: string) => void
 assignedTo?: string | null; members: Member[]; onAssign: (id: string | null) => void
}

export function LeadPipelineFields({ tags, tagDraft, onTagDraftChange, onAddTag, onRemoveTag, value, onValueChange, onSaveValue, stageId, stages, onChangeStage, assignedTo, members, onAssign }: Props) {
 return <>
      {/* Linha 4 — Tags */}
      <section className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tags</h4>
        <Input
          value={tagDraft}
          onChange={e => onTagDraftChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAddTag() } }}
          onBlur={onAddTag}
          placeholder="Nova tag…"
          className="h-8 text-sm w-32"
        />
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {tags.map(t => (
              <Badge key={t} variant="secondary" className="text-[10px] gap-1 pr-1">
                {t}
                <button
                  type="button"
                  onClick={() => onRemoveTag(t)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`Remover ${t}`}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </section>

      {/* Valor e estágio juntos; responsável com a largura inteira. */}
      <section className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <h4 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Valor</h4>
          <Input
            value={value}
            inputMode="numeric"
            onChange={e => {
              const cents = parseCurrency(e.target.value)
              onValueChange(cents > 0 ? formatCurrency(cents) : '')
            }}
            placeholder="R$ 0,00"
            className="h-8 min-w-0 px-2 text-xs md:text-xs"
            onBlur={onSaveValue}
          />
        </div>
        <div className="space-y-1">
          <h4 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Estágio</h4>
          <select
            className="w-full h-8 rounded-md border border-input bg-input/25 px-1.5 text-xs"
            value={stageId ?? ''}
            onChange={e => onChangeStage(e.target.value)}
          >
            {stages.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1 min-w-0 col-span-2">
          <h4 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Responsável</h4>
          <select
            className="w-full h-8 rounded-md border border-input bg-input/25 px-1.5 text-xs"
            value={assignedTo ?? ''}
            onChange={e => onAssign(e.target.value || null)}
          >
            <option value="">Ninguém</option>
            {members.map(m => (
              <option key={m.user_id} value={m.user_id}>{m.name || m.email}</option>
            ))}
          </select>
        </div>
      </section>


 </>
}
