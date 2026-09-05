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
  const rootRef = useRef<HTMLDivElement>(null)

  const current = assignedTo ? members.find(m => m.id === assignedTo) : null

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

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

  return (
    <div ref={rootRef} className="relative" onPointerDown={stop} onClick={stop}>
      <button
        type="button"
        title={current ? `Vendedor: ${current.name || current.email}` : 'Atribuir vendedor'}
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold transition-colors',
          current
            ? 'bg-brand-100 text-brand-700 hover:ring-2 hover:ring-brand-200'
            : 'border border-dashed border-border text-muted-foreground/60 hover:text-foreground hover:border-foreground/40',
          saving && 'opacity-50',
        )}
      >
        {current ? initials(current.name, current.email) : <UserPlus className="h-3 w-3" />}
      </button>

      {open && (
        <div className="absolute right-0 top-7 z-30 w-48 rounded-lg border bg-popover p-1  ">
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
        </div>
      )}
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
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    setTimeout(() => inputRef.current?.focus(), 10)
    return () => document.removeEventListener('mousedown', onDocClick)
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
    <div ref={rootRef} className="inline-flex" onPointerDown={stop} onClick={stop}>
      <button
        type="button"
        title="Adicionar tags"
        onClick={() => setOpen(o => !o)}
        className={cn(
          'inline-flex items-center gap-0.5 rounded-full border border-dashed border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground/70 transition-colors hover:border-foreground/40 hover:text-foreground',
          saving && 'opacity-50',
        )}
      >
        <Plus className="h-2.5 w-2.5" /> Tag
      </button>

      {/* Ancorado no canto da linha de badges/tags (ancestral `relative` mais
          próximo — ver o wrapper em LeadCard), não neste botão: como o botão
          "+ Tag" fica depois das tags já existentes numa linha que quebra
          (flex-wrap), a posição dele muda conforme tags são adicionadas. Se o
          popover seguisse o botão, ele "andava" a cada tag nova e acabava
          escondido atrás da coluna vizinha do Kanban. Ancorar no canto direito
          da linha (que sempre ocupa a largura inteira do card) mantém o
          popover sempre no mesmo lugar. */}
      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 w-52 rounded-lg border bg-popover p-2  ">
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
        </div>
      )}
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
  const rootRef = useRef<HTMLDivElement>(null)
  const current = stages.find(s => s.id === lead.stage_id)
  const accent = current?.color || '#6366f1'

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  function stop(e: React.MouseEvent | React.PointerEvent) {
    e.stopPropagation()
  }

  return (
    <div ref={rootRef} className="relative" onPointerDown={stop} onClick={stop}>
      <button
        type="button"
        title={current ? `Estágio: ${current.name} — clique para mover` : 'Mover para outro estágio'}
        onClick={() => setOpen(o => !o)}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-110"
      >
        <span
          className="h-3 w-3 rounded-full ring-2 ring-background"
          style={{ backgroundColor: accent, boxShadow: `0 0 0 1px ${accent}55` }}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-6 z-30 w-48 rounded-lg border bg-popover p-1  ">
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
        </div>
      )}
    </div>
  )
}
