'use client'

import { useState, useMemo, useTransition, useEffect, useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  MessageCircle,
  Mail,
  Phone,
  Plus,
  Settings2,
  Tag as TagIcon,
  Trash2,
  X,
  AlertTriangle,
  Save,
  Bookmark,
  Search,
  ArrowRightLeft,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { createLead, bulkUpdateLeads, bulkDeleteLeads, findDuplicateLead } from '@/actions/contatos'
import { createSavedFilter, deleteSavedFilter, type SavedFilter } from '@/actions/saved_filters'
import AIScoreBadge from '@/components/features/ai/AIScoreBadge'

type Lead = {
  id: string
  name: string
  email: string | null
  phone: string | null
  stage_id: string | null
  tags: string[] | null
  value_cents: number | null
  source: string | null
  created_at: string
  updated_at: string
  ai_score?: number | null
  ai_tier?: 'hot' | 'warm' | 'cold' | string | null
  ai_summary?: string | null
  pipeline_stages: { id: string; name: string } | { id: string; name: string }[] | null
}

type Stage = { id: string; name: string; pipeline_id?: string }
type Pipeline = { id: string; name: string; is_default: boolean }

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

const ALL_COLUMNS = [
  { key: 'contact', label: 'Contato' },
  { key: 'score', label: 'Score IA' },
  { key: 'stage', label: 'Estágio' },
  { key: 'tags', label: 'Tags' },
  { key: 'value', label: 'Valor' },
  { key: 'source', label: 'Origem' },
  { key: 'last_activity', label: 'Última atividade' },
  { key: 'created', label: 'Criado em' },
] as const

type ColKey = (typeof ALL_COLUMNS)[number]['key']

const STORAGE_KEY = 'althos.leads.columns.v1'

function getStageName(lead: Lead): string {
  const s = lead.pipeline_stages
  if (!s) return 'Sem estágio'
  if (Array.isArray(s)) return s[0]?.name || 'Sem estágio'
  return s.name
}

function buildWhatsAppUrl(phone: string | null) {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (!digits) return null
  return `https://wa.me/${digits.length === 11 || digits.length === 10 ? `55${digits}` : digits}`
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

      {/* Table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={leads.length > 0 && selected.size === leads.length}
                    onCheckedChange={toggleAll}
                    aria-label="Selecionar todos"
                  />
                </TableHead>
                <TableHead>Nome</TableHead>
                {isVisible('contact') && <TableHead>Contato</TableHead>}
                {isVisible('score') && <TableHead>Score IA</TableHead>}
                {isVisible('stage') && <TableHead>Estágio</TableHead>}
                {isVisible('tags') && <TableHead>Tags</TableHead>}
                {isVisible('value') && <TableHead>Valor</TableHead>}
                {isVisible('source') && <TableHead>Origem</TableHead>}
                {isVisible('last_activity') && <TableHead>Última atividade</TableHead>}
                {isVisible('created') && <TableHead>Criado em</TableHead>}
                <TableHead className="w-[120px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                    Nenhum lead corresponde aos filtros.
                  </TableCell>
                </TableRow>
              ) : (
                leads.map(lead => {
                  const wa = buildWhatsAppUrl(lead.phone)
                  const stalled =
                    Date.now() - new Date(lead.updated_at).getTime() > 7 * 24 * 60 * 60 * 1000
                  return (
                    <TableRow key={lead.id} data-selected={selected.has(lead.id)}>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <Checkbox
                          checked={selected.has(lead.id)}
                          onCheckedChange={() => toggle(lead.id)}
                          aria-label={`Selecionar ${lead.name}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/app/${orgSlug}/contatos/${lead.id}`}
                          className="font-medium hover:underline"
                        >
                          {lead.name}
                        </Link>
                      </TableCell>
                      {isVisible('contact') && (
                        <TableCell>
                          <div className="text-sm">{lead.email || '—'}</div>
                          <div className="text-xs text-muted-foreground">{lead.phone || '—'}</div>
                        </TableCell>
                      )}
                      {isVisible('score') && (
                        <TableCell>
                          {lead.ai_score != null ? (
                            <AIScoreBadge score={lead.ai_score} tier={lead.ai_tier} summary={lead.ai_summary} size="sm" />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      )}
                      {isVisible('stage') && (
                        <TableCell>
                          <Badge>{getStageName(lead)}</Badge>
                        </TableCell>
                      )}
                      {isVisible('tags') && (
                        <TableCell>
                          <div className="flex items-center gap-1 max-w-[160px] overflow-hidden">
                            {(lead.tags || []).slice(0, 2).map(t => (
                              <span
                                key={t}
                                className="inline-flex items-center shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground max-w-[72px] truncate"
                                title={t}
                              >
                                {t}
                              </span>
                            ))}
                            {(lead.tags?.length || 0) > 2 && (
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                +{(lead.tags?.length || 0) - 2}
                              </span>
                            )}
                          </div>
                        </TableCell>
                      )}
                      {isVisible('value') && (
                        <TableCell className="tabular-nums">
                          {lead.value_cents
                            ? `R$ ${(lead.value_cents / 100).toFixed(2)}`
                            : '—'}
                        </TableCell>
                      )}
                      {isVisible('source') && (
                        <TableCell className="text-xs text-muted-foreground">
                          {lead.source || '—'}
                        </TableCell>
                      )}
                      {isVisible('last_activity') && (
                        <TableCell>
                          <span className={stalled ? 'text-destructive text-xs' : 'text-xs text-muted-foreground'}>
                            {formatDistanceToNow(new Date(lead.updated_at), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                            {stalled && ' ⚠'}
                          </span>
                        </TableCell>
                      )}
                      {isVisible('created') && (
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                          {wa && (
                            <a
                              href={wa}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-muted text-green-600"
                              title="WhatsApp"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </a>
                          )}
                          {lead.email && (
                            <a
                              href={`mailto:${lead.email}`}
                              className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-muted text-blue-600"
                              title="E-mail"
                            >
                              <Mail className="w-4 h-4" />
                            </a>
                          )}
                          {lead.phone && (
                            <a
                              href={`tel:${lead.phone}`}
                              className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-muted text-muted-foreground"
                              title="Ligar"
                            >
                              <Phone className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

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

/* -------- Filter sheet -------- */

function FilterSheet({
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
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
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
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
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
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
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
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
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

/* -------- Saved filter menu -------- */

function SavedFilterMenu({
  filters,
  onApply,
  onSave,
  onDelete,
  hasActiveFilters,
}: {
  filters: SavedFilter[]
  onApply: (f: SavedFilter) => void
  onSave: (name: string, isShared: boolean) => Promise<void>
  onDelete: (id: string) => Promise<void>
  hasActiveFilters: boolean
}) {
  const [saveOpen, setSaveOpen] = useState(false)
  const [name, setName] = useState('')
  const [shared, setShared] = useState(false)
  const [saving, setSaving] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <Bookmark className="w-4 h-4 mr-2" /> Filtros salvos
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64">
          <DropdownMenuLabel>Aplicar</DropdownMenuLabel>
          {filters.length === 0 ? (
            <div className="px-2 py-3 text-xs text-muted-foreground">Nenhum filtro salvo ainda.</div>
          ) : (
            filters.map(f => (
              <DropdownMenuItem
                key={f.id}
                className="flex justify-between items-center"
                onClick={() => onApply(f)}
              >
                <span className="truncate">
                  {f.name} {f.is_shared && <span className="text-[10px] text-muted-foreground">· compartilhado</span>}
                </span>
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation()
                    onDelete(f.id)
                  }}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Remover"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={!hasActiveFilters}
            onClick={() => setSaveOpen(true)}
          >
            <Save className="w-4 h-4 mr-2" /> Salvar filtro atual
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salvar filtro atual</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: Quentes do Instagram"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={shared} onCheckedChange={c => setShared(!!c)} />
              Compartilhar com a equipe
            </label>
          </div>
          <DialogFooter>
            <Button
              disabled={saving || !name.trim()}
              onClick={async () => {
                setSaving(true)
                await onSave(name, shared)
                setSaving(false)
                setSaveOpen(false)
                setName('')
                setShared(false)
              }}
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/* -------- Columns toggle -------- */

function ColumnsMenu({
  hiddenCols,
  onToggle,
}: {
  hiddenCols: Set<ColKey>
  onToggle: (k: ColKey, hidden: boolean) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Colunas">
          <Settings2 className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Colunas</DropdownMenuLabel>
        {ALL_COLUMNS.map(c => (
          <DropdownMenuCheckboxItem
            key={c.key}
            checked={!hiddenCols.has(c.key)}
            onCheckedChange={checked => onToggle(c.key, !checked)}
          >
            {c.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* -------- New lead dialog with duplicate detection -------- */

function NewLeadDialog({ orgSlug, stages }: { orgSlug: string; stages: Stage[] }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [duplicate, setDuplicate] = useState<{ id: string; name: string } | null>(null)
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const router = useRouter()

  // Debounced duplicate check.
  useEffect(() => {
    if (!email && !phone) {
      setDuplicate(null)
      return
    }
    const t = setTimeout(async () => {
      const res = await findDuplicateLead(orgSlug, { email, phone })
      setDuplicate(res.match || null)
    }, 400)
    return () => clearTimeout(t)
  }, [email, phone, orgSlug])

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const formData = new FormData(e.currentTarget)
    const result = await createLead(orgSlug, formData)
    setLoading(false)
    if (!result.ok) {
      setError(result.error || 'Erro')
    } else {
      setOpen(false)
      setEmail('')
      setPhone('')
      setDuplicate(null)
      toast.success('Lead criado')
      router.refresh()
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-1" /> Novo Lead
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreate} className="space-y-3">
          {error && <div className="text-sm text-destructive">{error}</div>}
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              name="phone"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
          </div>
          {duplicate && (
            <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-3 text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <strong>Lead já existe:</strong> {duplicate.name}.
                <br />
                <Link
                  href={`/app/${orgSlug}/contatos/${duplicate.id}`}
                  className="underline text-amber-800 dark:text-amber-300"
                >
                  Abrir lead existente
                </Link>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="stage_id">Estágio</Label>
            <select
              name="stage_id"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="">(Padrão)</option>
              {stages.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="value_cents">Valor (centavos)</Label>
              <Input id="value_cents" name="value_cents" type="number" min="0" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tags">Tags (vírgula)</Label>
              <Input id="tags" name="tags" placeholder="urgente, b2b" />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* -------- Bulk action bar -------- */

function BulkBar({
  orgSlug,
  selected,
  stages,
  onClear,
  onDone,
}: {
  orgSlug: string
  selected: Set<string>
  stages: Stage[]
  onClear: () => void
  onDone: () => void
}) {
  const ids = useMemo(() => Array.from(selected), [selected])
  const [loading, setLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  async function moveToStage(stageId: string) {
    setLoading(true)
    const res = await bulkUpdateLeads(orgSlug, ids, { stage_id: stageId })
    setLoading(false)
    if (res.ok) {
      toast.success(`${res.count} lead(s) movido(s)`)
      onDone()
    } else {
      toast.error(res.error)
    }
  }

  async function addTag() {
    const tag = window.prompt('Tag a adicionar:')?.trim()
    if (!tag) return
    setLoading(true)
    const res = await bulkUpdateLeads(orgSlug, ids, { addTag: tag })
    setLoading(false)
    if (res.ok) {
      toast.success(`Tag "${tag}" adicionada a ${res.count} lead(s)`)
      onDone()
    } else {
      toast.error(res.error)
    }
  }

  async function deleteSelected() {
    setLoading(true)
    const res = await bulkDeleteLeads(orgSlug, ids)
    setLoading(false)
    if (res.ok) {
      toast.success(`${res.count} lead(s) excluído(s)`)
      onDone()
    } else {
      toast.error(res.error)
    }
  }

  function exportCsv() {
    // Simple client-side export of selected ids — server action with full data
    // is the next iteration; for now we hand the IDs to the user as CSV.
    const blob = new Blob([['contato_id', ...ids].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leads-selected-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40 bg-card border shadow-lg rounded-full px-4 py-2 flex items-center gap-2">
      <span className="text-sm font-medium pr-2">{ids.length} selecionado(s)</span>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" disabled={loading}>
            <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" /> Mover estágio
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {stages.map(s => (
            <DropdownMenuItem key={s.id} onClick={() => moveToStage(s.id)}>
              {s.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button size="sm" variant="outline" disabled={loading} onClick={addTag}>
        <TagIcon className="w-3.5 h-3.5 mr-1.5" /> Tag
      </Button>

      <Button size="sm" variant="outline" disabled={loading} onClick={exportCsv}>
        Exportar
      </Button>

      <Button size="sm" variant="destructive" disabled={loading} onClick={() => setShowDeleteConfirm(true)}>
        <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Excluir
      </Button>

      <Button size="sm" variant="ghost" onClick={onClear}>
        <X className="w-4 h-4" />
      </Button>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir leads?</AlertDialogTitle>
            <AlertDialogDescription>
              Excluir {ids.length} lead(s)? Essa ação é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { deleteSelected(); setShowDeleteConfirm(false) }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
