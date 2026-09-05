'use client'

import { useState, useMemo, useTransition, useEffect, useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  ChevronLeft,
  ChevronRight,
  X,
  Search,
} from 'lucide-react'
import { createSavedFilter, deleteSavedFilter, type SavedFilter } from '@/actions/saved_filters'
import type { Lead, Stage, Pipeline, ColKey } from './LeadsViewShared'
import { STORAGE_KEY } from './LeadsViewShared'
import FilterSheet from './LeadsViewFilterSheet'
import SavedFilterMenu from './LeadsViewSavedFilterMenu'
import ColumnsMenu from './LeadsViewColumnsMenu'
import NewLeadDialog from './LeadsViewNewLeadDialog'
import BulkBar from './LeadsViewBulkBar'
import LeadsTable from './LeadsViewTable'

export type { Lead, Stage, Pipeline }

type Props = {
  orgSlug: string
  leads: Lead[]
  total: number
  page: number
  pageSize: number
  stages: Stage[]
  pipelines: Pipeline[]
  allTags: string[]
  savedFilters: SavedFilter[]
  filters: Record<string, string | undefined>
}

export default function LeadsView({
  orgSlug,
  leads,
  total,
  page,
  pageSize,
  stages,
  pipelines,
  allTags,
  savedFilters,
  filters,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  // Search input is debounced before pushing to URL.
  const [search, setSearch] = useState(filters.q || '')
  useEffect(() => {
    const t = setTimeout(() => {
      const cur = searchParams?.get('q') || ''
      if (search !== cur) updateUrl({ q: search || null, page: null })
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  // Selection state for bulk actions.
  const [selected, setSelected] = useState<Set<string>>(new Set())
  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function toggleAll() {
    if (selected.size === leads.length) setSelected(new Set())
    else setSelected(new Set(leads.map(l => l.id)))
  }
  useEffect(() => {
    // Clear selection when underlying data changes (e.g., after pagination).
    setSelected(new Set())
  }, [leads])

  // Column visibility persisted in localStorage.
  const [hiddenCols, setHiddenCols] = useState<Set<ColKey>>(new Set())
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setHiddenCols(new Set(JSON.parse(raw)))
    } catch {}
  }, [])
  function setColumnHidden(col: ColKey, hidden: boolean) {
    setHiddenCols(prev => {
      const next = new Set(prev)
      if (hidden) next.add(col)
      else next.delete(col)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)))
      } catch {}
      return next
    })
  }
  const isVisible = (k: ColKey) => !hiddenCols.has(k)

  // URL helper.
  const updateUrl = useCallback(
    (updates: Record<string, string | number | null>) => {
      const params = new URLSearchParams(searchParams?.toString() || '')
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === '' || v === undefined) params.delete(k)
        else params.set(k, String(v))
      }
      startTransition(() => router.push(`${pathname}?${params.toString()}`))
    },
    [pathname, router, searchParams],
  )

  // Active filter chips (anything beyond q + page).
  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string }> = []
    if (filters.pipeline_id) {
      const p = pipelines.find(x => x.id === filters.pipeline_id)
      chips.push({ key: 'pipeline_id', label: `Pipeline: ${p?.name || filters.pipeline_id}` })
    }
    if (filters.stage) {
      const s = stages.find(x => x.id === filters.stage)
      chips.push({ key: 'stage', label: `Estágio: ${s?.name || filters.stage}` })
    }
    if (filters.tag) chips.push({ key: 'tag', label: `Tag: ${filters.tag}` })
    if (filters.tier) chips.push({ key: 'tier', label: `IA: ${filters.tier}` })
    if (filters.has_email === '1') chips.push({ key: 'has_email', label: 'Com e-mail' })
    if (filters.has_phone === '1') chips.push({ key: 'has_phone', label: 'Com telefone' })
    if (filters.no_contact_days)
      chips.push({ key: 'no_contact_days', label: `Sem contato há ${filters.no_contact_days}d` })
    if (filters.created_from || filters.created_to)
      chips.push({
        key: 'created',
        label: `Criado: ${filters.created_from || '...'} → ${filters.created_to || '...'}`,
      })
    if (filters.value_min || filters.value_max)
      chips.push({
        key: 'value',
        label: `R$ ${filters.value_min || 0} – ${filters.value_max || '∞'}`,
      })
    return chips
  }, [filters, stages, pipelines])

  function clearChip(key: string) {
    if (key === 'created') updateUrl({ created_from: null, created_to: null, page: null })
    else if (key === 'value') updateUrl({ value_min: null, value_max: null, page: null })
    else updateUrl({ [key]: null, page: null })
  }
  function clearAll() {
    startTransition(() => router.push(pathname || ''))
    setSearch('')
  }

  function applySavedFilter(filter: SavedFilter) {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(filter.config || {})) {
      if (v != null && v !== '') params.set(k, String(v))
    }
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
    setSearch((filter.config?.q as string) || '')
  }

  async function handleSaveFilter(name: string, isShared: boolean) {
    const config: Record<string, any> = {}
    for (const [k, v] of Array.from(searchParams?.entries() || [])) {
      if (k !== 'page') config[k] = v
    }
    const res = await createSavedFilter(orgSlug, { name, entity: 'leads', config, is_shared: isShared })
    if (res.ok) {
      toast.success('Filtro salvo')
      router.refresh()
    } else {
      toast.error(res.error)
    }
  }

  async function handleDeleteFilter(id: string) {
    const res = await deleteSavedFilter(orgSlug, id)
    if (res.ok) {
      toast.success('Filtro removido')
      router.refresh()
    } else {
      toast.error(res.error)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar nome, e-mail, telefone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <FilterSheet
          stages={stages}
          pipelines={pipelines}
          allTags={allTags}
          filters={filters}
          onApply={updateUrl}
        />

        <SavedFilterMenu
          filters={savedFilters}
          onApply={applySavedFilter}
          onSave={handleSaveFilter}
          onDelete={handleDeleteFilter}
          hasActiveFilters={activeChips.length > 0 || !!search}
        />

        <ColumnsMenu hiddenCols={hiddenCols} onToggle={setColumnHidden} />

        <div className="flex-1" />

        <NewLeadDialog orgSlug={orgSlug} stages={stages} />
      </div>

      {/* Active chips */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          {activeChips.map(c => (
            <Badge
              key={c.key}
              variant="secondary"
              className="flex items-center gap-1 cursor-pointer hover:bg-secondary/80"
              onClick={() => clearChip(c.key)}
            >
              {c.label}
              <X className="w-3 h-3" />
            </Badge>
          ))}
          <Button variant="ghost" size="sm" onClick={clearAll} className="h-6 text-xs">
            Limpar tudo
          </Button>
        </div>
      )}

      <LeadsTable
        orgSlug={orgSlug}
        leads={leads}
        selected={selected}
        onToggle={toggle}
        onToggleAll={toggleAll}
        isVisible={isVisible}
      />

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} de {total} leads
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 0 || isPending}
              onClick={() => updateUrl({ page: page })}
            >
              <ChevronLeft className="w-4 h-4" /> Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1 || isPending}
              onClick={() => updateUrl({ page: page + 2 })}
            >
              Próxima <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <BulkBar
          orgSlug={orgSlug}
          selected={selected}
          stages={stages}
          onClear={() => setSelected(new Set())}
          onDone={() => {
            setSelected(new Set())
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
