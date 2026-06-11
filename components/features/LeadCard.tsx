'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useState, useRef, useEffect } from 'react'
import { updateLeadValue, assignLead, updateLeadTags } from '@/actions/leads'
import { cn } from '@/lib/utils'
import { MessageCircle, Mail, UserCheck, Sparkles, UserPlus, Check, Tag, Plus, X, MessagesSquare } from 'lucide-react'
import Link from 'next/link'
import LeadFormResponsesButton from './LeadFormResponsesButton'
import LeadProposalsButton from './LeadProposalsButton'

export type CardMember = { id: string; name: string; email: string }

// ── Inline value editor ────────────────────────────────────────────────────────
function ValueEditor({ lead, orgSlug }: { lead: any; orgSlug: string }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(lead.value_cents ? String(lead.value_cents / 100) : '')
  const [localCents, setLocalCents] = useState<number | null>(lead.value_cents ?? null)
  const inputRef = useRef<HTMLInputElement>(null)

  const display = localCents
    ? `R$ ${(localCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    : 'Adicionar valor'

  function open(e: React.MouseEvent) {
    e.stopPropagation()
    e.preventDefault()
    setEditing(true)
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select() }, 10)
  }

  async function commit() {
    setEditing(false)
    const cents = val.trim() === '' ? 0 : Math.round(parseFloat(val.replace(',', '.')) * 100)
    if (!isNaN(cents) && cents !== (lead.value_cents || 0)) {
      setLocalCents(cents || null)
      await updateLeadValue(orgSlug, lead.id, cents)
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        min="0"
        step="1"
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          e.stopPropagation()
          if (e.key === 'Enter') { e.preventDefault(); commit() }
          if (e.key === 'Escape') { e.preventDefault(); setEditing(false) }
        }}
        onPointerDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
        className="w-full text-sm font-semibold border border-primary rounded px-1.5 py-0.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary tabular-nums"
        placeholder="0"
      />
    )
  }

  return (
    <button
      type="button"
      onPointerDown={e => e.stopPropagation()}
      onClick={open}
      className={cn(
        'text-sm font-semibold tabular-nums transition-colors',
        localCents ? 'text-foreground hover:text-primary' : 'text-muted-foreground/50 hover:text-muted-foreground',
      )}
    >
      {display}
    </button>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────────
function initials(name: string, email: string): string {
  const base = name?.trim() || email?.split('@')[0] || '?'
  const parts = base.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return base.slice(0, 2).toUpperCase()
}

const TIER = {
  hot:    { label: 'Quente', cls: 'bg-rose-100 text-rose-700' },
  quente: { label: 'Quente', cls: 'bg-rose-100 text-rose-700' },
  warm:   { label: 'Morno',  cls: 'bg-amber-100 text-amber-700' },
  morno:  { label: 'Morno',  cls: 'bg-amber-100 text-amber-700' },
  cold:   { label: 'Frio',   cls: 'bg-sky-100 text-sky-700' },
  frio:   { label: 'Frio',   cls: 'bg-sky-100 text-sky-700' },
} as const

function onlyDigits(s?: string | null) {
  return (s || '').replace(/\D/g, '')
}

// ── Seller / responsável picker ─────────────────────────────────────────────────
// Small avatar button on the card; clicking opens a dropdown to pick one of the
// org members (admin or guests). Stops dnd propagation so it doesn't start a drag.
function SellerPicker({
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
        <div className="absolute right-0 top-7 z-30 w-48 rounded-lg border bg-popover p-1 shadow-lg">
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
function TagEditor({
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
    <div ref={rootRef} className="relative inline-flex" onPointerDown={stop} onClick={stop}>
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

      {open && (
        <div className="absolute left-0 top-6 z-30 w-52 rounded-lg border bg-popover p-2 shadow-lg">
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
function StagePicker({
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
        <div className="absolute left-0 top-6 z-30 w-48 rounded-lg border bg-popover p-1 shadow-lg">
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

// ── Main card ──────────────────────────────────────────────────────────────────
export default function LeadCard({
  lead,
  orgSlug,
  isOverlay,
  onClick,
  owner,
  members,
  stages,
  onStageChange,
}: {
  lead: any
  orgSlug: string
  isOverlay?: boolean
  onClick?: () => void
  owner?: CardMember | null
  members?: CardMember[]
  stages?: any[]
  onStageChange?: (stageId: string) => void
}) {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id, data: { type: 'Lead', lead } })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  }

  const refDate = lead.last_activity_at || lead.updated_at
  const isStalled = refDate
    ? Date.now() - new Date(refDate).getTime() > 7 * 24 * 60 * 60 * 1000
    : false

  const [tags, setTags] = useState<string[]>(lead.tags || [])
  const visibleTags = tags.slice(0, 2)
  const extraTags = tags.length - visibleTags.length

  const tier = lead.ai_tier ? TIER[String(lead.ai_tier).toLowerCase() as keyof typeof TIER] : null
  const phoneDigits = onlyDigits(lead.phone)

  function stop(e: React.MouseEvent | React.PointerEvent) {
    e.stopPropagation()
  }

  return (
    <div
      ref={isOverlay ? null : setNodeRef}
      style={isOverlay ? undefined : style}
      {...attributes}
      className={cn(
        'group/card relative bg-background border rounded-xl shadow-sm select-none transition-all',
        isOverlay ? 'shadow-xl rotate-1 scale-[1.02]' : 'hover:border-primary/40 hover:shadow-md',
        isDragging ? 'opacity-30' : '',
      )}
    >
      {/* Left accent for stalled deals */}
      {isStalled && <span className="absolute left-0 top-0 h-full w-1 rounded-l-xl bg-amber-400" />}

      {/* Drag handle area — stage dot + title + seller + value */}
      <div
        {...listeners}
        onClick={() => onClick?.()}
        className="px-2.5 pt-2 pb-1.5 cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-start gap-1.5">
          {!isOverlay && stages && onStageChange ? (
            <div className="pt-0.5">
              <StagePicker lead={lead} stages={stages} onPick={onStageChange} />
            </div>
          ) : null}
          <p className="min-w-0 flex-1 text-sm font-semibold leading-snug text-foreground line-clamp-2">
            {lead.name}
          </p>
          {members && !isOverlay ? (
            <SellerPicker lead={lead} orgSlug={orgSlug} members={members} />
          ) : owner ? (
            <span
              title={owner.name || owner.email}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700"
            >
              {initials(owner.name, owner.email)}
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 pl-[26px]">
          <ValueEditor lead={lead} orgSlug={orgSlug} />
        </div>
      </div>

      {/* Badges + tags row */}
      {(tier || lead.is_customer || tags.length > 0 || !isOverlay) && (
        <div className="flex flex-wrap items-center gap-1 px-2.5 pb-1.5">
          {tier && (
            <span className={cn('inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold', tier.cls)}>
              <Sparkles className="h-2.5 w-2.5" />
              {tier.label}
            </span>
          )}
          {lead.is_customer && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
              <UserCheck className="h-2.5 w-2.5" />
              Cliente
            </span>
          )}
          {visibleTags.map(t => (
            <span
              key={t}
              className="group/tag relative inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground max-w-[90px]"
              title={t}
            >
              <span className="truncate">{t}</span>
              {!isOverlay && (
                <button
                  type="button"
                  onPointerDown={stop}
                  onClick={(e) => { stop(e); setTags(prev => { const next = prev.filter(x => x !== t); updateLeadTags(orgSlug, lead.id, next); return next }) }}
                  aria-label={`Remover ${t}`}
                  className="absolute -right-1 -top-1 hidden h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow group-hover/tag:flex"
                >
                  <X className="h-2 w-2" />
                </button>
              )}
            </span>
          ))}
          {extraTags > 0 && <span className="text-[10px] text-muted-foreground">+{extraTags}</span>}
          {!isOverlay && (
            <TagEditor lead={lead} orgSlug={orgSlug} tags={tags} onChange={setTags} />
          )}
        </div>
      )}

      {/* Footer: timestamp + quick actions */}
      <div className="flex items-center justify-between border-t border-border/60 px-2.5 py-1">
        <p className={cn('text-[10px]', isStalled ? 'font-medium text-amber-600' : 'text-muted-foreground/70')}>
          {refDate ? `há ${formatDistanceToNow(new Date(refDate), { locale: ptBR })}` : 'sem atividade'}
        </p>
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/card:opacity-100">
          {!isOverlay && <LeadFormResponsesButton orgSlug={orgSlug} leadId={lead.id} />}
          {!isOverlay && <LeadProposalsButton orgSlug={orgSlug} leadId={lead.id} />}
          {!isOverlay && (
            <Link
              href={`/app/${orgSlug}/conversas?lead=${lead.id}`}
              onPointerDown={stop}
              onClick={stop}
              title="Abrir conversa"
              className="flex h-6 w-6 items-center justify-center rounded-md text-indigo-600 hover:bg-indigo-50"
            >
              <MessagesSquare className="h-3.5 w-3.5" />
            </Link>
          )}
          {phoneDigits && (
            <a
              href={`https://wa.me/${phoneDigits}`}
              target="_blank"
              rel="noopener noreferrer"
              onPointerDown={stop}
              onClick={stop}
              title="WhatsApp"
              className="flex h-6 w-6 items-center justify-center rounded-md text-emerald-600 hover:bg-emerald-50"
            >
              <MessageCircle className="h-3.5 w-3.5" />
            </a>
          )}
          {lead.email && (
            <a
              href={`mailto:${lead.email}`}
              onPointerDown={stop}
              onClick={stop}
              title="E-mail"
              className="flex h-6 w-6 items-center justify-center rounded-md text-sky-600 hover:bg-sky-50"
            >
              <Mail className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
