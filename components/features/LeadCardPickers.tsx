'use client'

/**
 * Small interactive pickers used on LeadCard (seller/responsável, tags,
 * stage). Each stops dnd-kit pointer propagation so clicking them
 * doesn't start a drag. Split out of LeadCard.tsx.
 */

import { useState, useRef, useEffect } from 'react'
import { assignLead, updateLeadTags } from '@/actions/contatos'
import { cn } from '@/lib/utils'
import { UserPlus, Check, Tag, Plus, X } from 'lucide-react'
import { initials, type CardMember } from './LeadCard'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'

// Os 3 pickers abaixo usavam um <div absolute> feito à mão pro dropdown —
// dentro de uma coluna do Kanban (que tem overflow-y-auto/overflow-hidden
// pro scroll da lista de leads), isso cortava o popover quando ele
// extrapolava a largura/altura da coluna, ou deixava ele atrás da coluna
// vizinha (a posição "absolute" não escapa do clipping do ancestral, e o
// z-index só compete dentro do mesmo contexto de empilhamento). Trocado
// pelo Popover do design system (Radix): renderiza num portal direto no
// <body>, então nunca é cortado nem fica atrás de outro elemento — e abre
// sempre para a direita do gatilho (side="right"), com colisão de viewport
// automática do Radix se não couber.

// ── Seller / responsável picker ─────────────────────────────────────────────────
// Small avatar button on the card; clicking opens a dropdown to pick one of the
// org members (admin or guests). Stops dnd propagation so it doesn't start a drag.
export function SellerPicker({
  lead,
  orgSlug,
  members,
}: {
  lead: any
  orgSlug: string
  members: CardMember[]
}) {
  const [open, setOpen] = useState(false)
  const [assignedTo, setAssignedTo] = useState<string | null>(lead.assigned_to ?? null)
  const [saving, setSaving] = useState(false)

  const current = assignedTo ? members.find(m => m.id === assignedTo) : null

  async function pick(userId: string | null) {
    setOpen(false)
    setAssignedTo(userId)
    setSaving(true)
    await assignLead(orgSlug, lead.id, userId)
    setSaving(false)
  }

  function stop(e: React.MouseEvent | React.PointerEvent) {
    e.stopPropagation()
  }

  const currentName = current ? (current.name || current.email) : ''
  const currentLabel = currentName.length > 20 ? `${currentName.slice(0, 20)}…` : currentName

  return (
    <div className="shrink-0" onPointerDown={stop} onClick={stop}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title={current ? `Vendedor: ${currentName}` : 'Atribuir vendedor'}
            className={cn(
              'flex h-6 max-w-[124px] shrink-0 items-center justify-center gap-1 rounded-pill px-2 text-[10px] font-semibold transition-colors',
              current
                ? 'bg-brand-100 text-brand-700 hover:ring-2 hover:ring-brand-200'
                : 'w-6 border border-dashed border-border text-muted-foreground/60 hover:text-foreground hover:border-foreground/40',
              saving && 'opacity-50',
            )}
          >
            {current ? <span className="truncate">{currentLabel}</span> : <UserPlus className="h-3 w-3" />}
          </button>
        </PopoverTrigger>
        <PopoverContent side="right" align="start" sideOffset={6} className="w-48 p-1">
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Vendedor
          </div>
          <button
            type="button"
            onClick={() => pick(null)}
            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted"
          >
            <span className="text-muted-foreground">Sem responsável</span>
            {!assignedTo && <Check className="h-3.5 w-3.5 text-brand-600" />}
          </button>
          {members.map(m => (
            <button
              key={m.id}
              type="button"
              onClick={() => pick(m.id)}
              className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted"
            >
              <span className="flex items-center gap-2 min-w-0">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[9px] font-semibold text-brand-700">
                  {initials(m.name, m.email)}
                </span>
                <span className="truncate">{m.name || m.email}</span>
              </span>
              {assignedTo === m.id && <Check className="h-3.5 w-3.5 shrink-0 text-brand-600" />}
            </button>
          ))}
          {members.length === 0 && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum membro encontrado</div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}

// ── Tag editor ───────────────────────────────────────────────────────────────────
// Small "+ tag" button on the card; opens a popover to add/remove tags. Stops dnd
// propagation so it doesn't start a drag. Optimistically updates local state.
export function TagEditor({
  lead,
  orgSlug,
  tags,
  onChange,
}: {
  lead: any
  orgSlug: string
  tags: string[]
  onChange: (tags: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setTimeout(() => inputRef.current?.focus(), 10)
  }, [open])

  async function commit(next: string[]) {
    onChange(next)
    setSaving(true)
    const res = await updateLeadTags(orgSlug, lead.id, next)
    setSaving(false)
    if (res.ok && res.tags) onChange(res.tags)
  }

  function addTag() {
    const t = draft.trim()
    if (!t) return
    if (!tags.includes(t)) commit([...tags, t])
    setDraft('')
  }

  function stop(e: React.MouseEvent | React.PointerEvent) {
    e.stopPropagation()
  }

  return (
    <div className="inline-flex" onPointerDown={stop} onClick={stop}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title="Adicionar tags"
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full border border-dashed border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground/70 transition-colors hover:border-foreground/40 hover:text-foreground',
              saving && 'opacity-50',
            )}
          >
            <Plus className="h-2.5 w-2.5" /> Tag
          </button>
        </PopoverTrigger>
        <PopoverContent side="right" align="start" sideOffset={6} className="w-52 p-2">
          <div className="mb-1.5 flex items-center gap-1 px-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Tag className="h-3 w-3" /> Tags
          </div>
          {tags.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1">
              {tags.map(t => (
                <span
                  key={t}
                  className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                >
                  <span className="max-w-[90px] truncate" title={t}>{t}</span>
                  <button
                    type="button"
                    onClick={() => commit(tags.filter(x => x !== t))}
                    className="text-muted-foreground/60 hover:text-destructive"
                    aria-label={`Remover ${t}`}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-1">
            <input
              ref={inputRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                e.stopPropagation()
                if (e.key === 'Enter') { e.preventDefault(); addTag() }
                if (e.key === 'Escape') { e.preventDefault(); setOpen(false) }
              }}
              placeholder="Nova tag…"
              maxLength={40}
              className="h-7 flex-1 rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="button"
              onClick={addTag}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
              aria-label="Adicionar tag"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

// ── Stage picker ───────────────────────────────────────────────────────────────
// Small pill on the card showing the current pipeline stage; clicking opens a
// dropdown to move the lead to another stage directly. Stops dnd propagation.
export function StagePicker({
  lead,
  stages,
  onPick,
}: {
  lead: any
  stages: any[]
  onPick: (stageId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const current = stages.find(s => s.id === lead.stage_id)
  const accent = current?.color || '#6366f1'

  function stop(e: React.MouseEvent | React.PointerEvent) {
    e.stopPropagation()
  }

  return (
    <div onPointerDown={stop} onClick={stop}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title={current ? `Estágio: ${current.name} — clique para mover` : 'Mover para outro estágio'}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-110"
          >
            <span
              className="h-3 w-3 rounded-full ring-2 ring-background"
              style={{ backgroundColor: accent, boxShadow: `0 0 0 1px ${accent}55` }}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent side="right" align="start" sideOffset={6} className="w-48 p-1">
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Mover para
          </div>
          {stages.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => { setOpen(false); if (s.id !== lead.stage_id) onPick(s.id) }}
              className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted"
            >
              <span className="flex items-center gap-2 min-w-0">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color || '#94a3b8' }} />
                <span className="truncate">{s.name}</span>
              </span>
              {s.id === lead.stage_id && <Check className="h-3.5 w-3.5 shrink-0 text-brand-600" />}
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  )
}
