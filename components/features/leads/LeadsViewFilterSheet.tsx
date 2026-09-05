'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from '@/components/ui/sheet'
import { Filter } from 'lucide-react'
import type { Stage, Pipeline } from './LeadsViewShared'

/* -------- Filter sheet -------- */

export default function FilterSheet({
  stages,
  pipelines,
  allTags,
  filters,
  onApply,
}: {
  stages: Stage[]
  pipelines: Pipeline[]
  allTags: string[]
  filters: Record<string, string | undefined>
  onApply: (updates: Record<string, string | number | null>) => void
}) {
  const [draft, setDraft] = useState({
    pipeline_id: filters.pipeline_id || '',
    stage: filters.stage || '',
    tag: filters.tag || '',
    tier: filters.tier || '',
    has_email: filters.has_email === '1',
    has_phone: filters.has_phone === '1',
    no_contact_days: filters.no_contact_days || '',
    created_from: filters.created_from || '',
    created_to: filters.created_to || '',
    value_min: filters.value_min || '',
    value_max: filters.value_max || '',
  })

  function apply() {
    onApply({
      pipeline_id: draft.pipeline_id || null,
      // If user changed pipeline, clear the stage filter — stages are
      // pipeline-scoped so the old stage_id likely doesn't apply anymore.
      stage: draft.pipeline_id !== filters.pipeline_id ? null : draft.stage || null,
      tag: draft.tag || null,
      tier: draft.tier || null,
      has_email: draft.has_email ? '1' : null,
      has_phone: draft.has_phone ? '1' : null,
      no_contact_days: draft.no_contact_days || null,
      created_from: draft.created_from || null,
      created_to: draft.created_to || null,
      value_min: draft.value_min || null,
      value_max: draft.value_max || null,
      page: null,
    })
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">
          <Filter className="w-4 h-4 mr-2" /> Filtros
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Filtros</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-6">
          {pipelines.length > 1 && (
            <div className="space-y-2">
              <Label>Pipeline</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-input/25 px-3 text-sm"
                value={draft.pipeline_id}
                onChange={e => setDraft({ ...draft, pipeline_id: e.target.value, stage: '' })}
              >
                <option value="">Todos</option>
                {pipelines.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.is_default ? ' · padrão' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Estágio</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-input/25 px-3 text-sm"
              value={draft.stage}
              onChange={e => setDraft({ ...draft, stage: e.target.value })}
            >
              <option value="">Todos</option>
              {stages
                .filter(s => !draft.pipeline_id || !s.pipeline_id || s.pipeline_id === draft.pipeline_id)
                .map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Tag</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-input/25 px-3 text-sm"
              value={draft.tag}
              onChange={e => setDraft({ ...draft, tag: e.target.value })}
            >
              <option value="">Qualquer</option>
              {allTags.map(t => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Score IA (tier)</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-input/25 px-3 text-sm"
              value={draft.tier}
              onChange={e => setDraft({ ...draft, tier: e.target.value })}
            >
              <option value="">Qualquer</option>
              <option value="hot">🔥 Hot</option>
              <option value="warm">🌤 Warm</option>
              <option value="cold">❄ Cold</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={draft.has_email}
                onCheckedChange={c => setDraft({ ...draft, has_email: !!c })}
              />
              Tem e-mail
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={draft.has_phone}
                onCheckedChange={c => setDraft({ ...draft, has_phone: !!c })}
              />
              Tem telefone
            </label>
          </div>

          <div className="space-y-2">
            <Label>Sem contato há (dias)</Label>
            <Input
              type="number"
              min="0"
              placeholder="ex: 7"
              value={draft.no_contact_days}
              onChange={e => setDraft({ ...draft, no_contact_days: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>Criado de</Label>
              <Input
                type="date"
                value={draft.created_from}
                onChange={e => setDraft({ ...draft, created_from: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Até</Label>
              <Input
                type="date"
                value={draft.created_to}
                onChange={e => setDraft({ ...draft, created_to: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>Valor mín (R$)</Label>
              <Input
                type="number"
                min="0"
                value={draft.value_min}
                onChange={e => setDraft({ ...draft, value_min: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Valor máx (R$)</Label>
              <Input
                type="number"
                min="0"
                value={draft.value_max}
                onChange={e => setDraft({ ...draft, value_max: e.target.value })}
              />
            </div>
          </div>

          <SheetClose asChild>
            <Button onClick={apply} className="w-full">
              Aplicar filtros
            </Button>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  )
}
