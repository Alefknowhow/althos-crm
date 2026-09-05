'use client'

/**
 * The filters sheet and saved-filter dropdown menu for ContatosView.
 * Split out of ContatosView.tsx.
 */

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from '@/components/ui/sheet'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SlidersHorizontal, Bookmark, X, Plus } from 'lucide-react'
import { contatoSourceLabel } from '@/lib/contatos'
import { createSavedFilter, deleteSavedFilter, type SavedFilter } from '@/actions/saved_filters'
import type { Filters } from './ContatosViewShared'

export function countActiveFilters(f: Filters): number {
  const keys = ['source', 'tag', 'tier', 'has_email', 'has_phone', 'no_contact_days',
    'created_from', 'created_to', 'value_min', 'value_max', 'pipeline_id', 'stage']
  return keys.reduce((n, k) => n + (f[k] ? 1 : 0), 0)
}

export function FiltersSheet({
  filters, allTags, allSources, pipelines, activeCount, onApply, onClear,
}: {
  filters: Filters
  allTags: string[]
  allSources: string[]
  pipelines: { id: string; name: string; is_default: boolean }[]
  activeCount: number
  onApply: (patch: Record<string, string | null>) => void
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Filters>(filters)
  useEffect(() => { if (open) setDraft(filters) }, [open, filters])

  function set(k: string, v: string) {
    setDraft(d => ({ ...d, [k]: v }))
  }
  function apply() {
    const patch: Record<string, string | null> = {}
    for (const k of ['source', 'tag', 'tier', 'has_email', 'has_phone', 'no_contact_days',
      'created_from', 'created_to', 'value_min', 'value_max', 'pipeline_id']) {
      patch[k] = draft[k] ? String(draft[k]) : null
    }
    onApply(patch)
    setOpen(false)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline">
          <SlidersHorizontal className="w-4 h-4 mr-1.5" /> Filtros
          {activeCount > 0 && (
            <span className="ml-1.5 rounded-full bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 tabular-nums">
              {activeCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Filtros</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Origem</Label>
            <select
              className="w-full h-9 rounded-md border border-input bg-input/25 px-3 text-sm"
              value={draft.source || ''}
              onChange={e => set('source', e.target.value)}
            >
              <option value="">Todas</option>
              {allSources.map(s => (
                <option key={s} value={s}>{contatoSourceLabel(s)}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Tag</Label>
            <select
              className="w-full h-9 rounded-md border border-input bg-input/25 px-3 text-sm"
              value={draft.tag || ''}
              onChange={e => set('tag', e.target.value)}
            >
              <option value="">Todas</option>
              {allTags.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Funil</Label>
            <select
              className="w-full h-9 rounded-md border border-input bg-input/25 px-3 text-sm"
              value={draft.pipeline_id || ''}
              onChange={e => set('pipeline_id', e.target.value)}
            >
              <option value="">Todos</option>
              {pipelines.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Classificação IA</Label>
            <select
              className="w-full h-9 rounded-md border border-input bg-input/25 px-3 text-sm"
              value={draft.tier || ''}
              onChange={e => set('tier', e.target.value)}
            >
              <option value="">Todas</option>
              <option value="hot">Quente</option>
              <option value="warm">Morno</option>
              <option value="cold">Frio</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-gray-300 accent-primary"
                checked={draft.has_email === '1'}
                onChange={e => set('has_email', e.target.checked ? '1' : '')}
              />
              Com e-mail
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-gray-300 accent-primary"
                checked={draft.has_phone === '1'}
                onChange={e => set('has_phone', e.target.checked ? '1' : '')}
              />
              Com telefone
            </label>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Sem contato há (dias)</Label>
            <Input
              type="number" min={0}
              value={draft.no_contact_days || ''}
              onChange={e => set('no_contact_days', e.target.value)}
              placeholder="ex.: 30"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Criado de</Label>
              <Input type="date" className="w-40" value={draft.created_from || ''} onChange={e => set('created_from', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Criado até</Label>
              <Input type="date" className="w-40" value={draft.created_to || ''} onChange={e => set('created_to', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Valor mín. (R$)</Label>
              <Input type="number" min={0} value={draft.value_min || ''} onChange={e => set('value_min', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Valor máx. (R$)</Label>
              <Input type="number" min={0} value={draft.value_max || ''} onChange={e => set('value_max', e.target.value)} />
            </div>
          </div>
        </div>
        <SheetFooter className="flex-row justify-between gap-2">
          <Button variant="ghost" onClick={() => { onClear(); setOpen(false) }}>Limpar tudo</Button>
          <Button onClick={apply}>Aplicar filtros</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ── Menu de filtros salvos ───────────────────────────────────────────
export function SavedFilterMenu({
  orgSlug, savedFilters, filters, onApply,
}: {
  orgSlug: string
  savedFilters: SavedFilter[]
  filters: Filters
  onApply: (config: Record<string, string | null>) => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function hasActiveFilters(): boolean {
    return Object.entries(filters).some(([k, v]) => v && k !== 'sel' && k !== 'page')
  }

  async function save() {
    const name = window.prompt('Nome do filtro salvo:')
    if (!name?.trim()) return
    const config: Record<string, string> = {}
    for (const [k, v] of Object.entries(filters)) {
      if (v && k !== 'sel' && k !== 'page') config[k] = String(v)
    }
    const res = await createSavedFilter(orgSlug, { name: name.trim(), entity: 'leads', config })
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Filtro salvo.')
    router.refresh()
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteSavedFilter(orgSlug, id)
      if (!res.ok) { toast.error(res.error); return }
      toast.success('Filtro removido.')
      router.refresh()
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline">
          <Bookmark className="w-4 h-4 mr-1.5" /> Salvos
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel>Filtros salvos</DropdownMenuLabel>
        {savedFilters.length === 0 && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum filtro salvo.</div>
        )}
        {savedFilters.map(f => (
          <div key={f.id} className="flex items-center gap-1 px-1">
            <DropdownMenuItem
              className="flex-1"
              onSelect={() => {
                const config: Record<string, string | null> = {
                  q: null, source: null, tag: null, tier: null, has_email: null, has_phone: null,
                  no_contact_days: null, created_from: null, created_to: null,
                  value_min: null, value_max: null, pipeline_id: null, stage: null,
                  ...(f.config as Record<string, string>),
                }
                onApply(config)
              }}
            >
              {f.name}
            </DropdownMenuItem>
            <button
              className="p-1 text-muted-foreground hover:text-destructive"
              onClick={() => remove(f.id)}
              disabled={pending}
              aria-label="Remover"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!hasActiveFilters()} onSelect={() => save()}>
          <Plus className="w-4 h-4 mr-1.5" /> Salvar filtro atual
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
