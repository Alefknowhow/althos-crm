'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useState, useRef } from 'react'
import { updateLeadValue } from '@/actions/leads'
import { cn } from '@/lib/utils'
import { MessageCircle, Mail, UserCheck, Sparkles } from 'lucide-react'

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

// ── Main card ──────────────────────────────────────────────────────────────────
export default function LeadCard({
  lead,
  orgSlug,
  isOverlay,
  onClick,
  owner,
}: {
  lead: any
  orgSlug: string
  isOverlay?: boolean
  onClick?: () => void
  owner?: CardMember | null
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

  const tags: string[] = lead.tags || []
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
        'group/card relative bg-background border rounded-xl shadow-sm select-none transition-all overflow-hidden',
        isOverlay ? 'shadow-xl rotate-1 scale-[1.02]' : 'hover:border-primary/40 hover:shadow-md',
        isDragging ? 'opacity-30' : '',
      )}
    >
      {/* Left accent for stalled deals */}
      {isStalled && <span className="absolute left-0 top-0 h-full w-1 bg-amber-400" />}

      {/* Drag handle area — title + value */}
      <div
        {...listeners}
        onClick={() => onClick?.()}
        className="px-3 pt-3 pb-2 cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold leading-snug text-foreground line-clamp-2">
            {lead.name}
          </p>
          {owner && (
            <span
              title={owner.name || owner.email}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700"
            >
              {initials(owner.name, owner.email)}
            </span>
          )}
        </div>
        <div className="mt-1">
          <ValueEditor lead={lead} orgSlug={orgSlug} />
        </div>
      </div>

      {/* Badges row */}
      {(tier || lead.is_customer || tags.length > 0) && (
        <div className="flex flex-wrap items-center gap-1 px-3 pb-2">
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
              className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground max-w-[80px] truncate"
              title={t}
            >
              {t}
            </span>
          ))}
          {extraTags > 0 && <span className="text-[10px] text-muted-foreground">+{extraTags}</span>}
        </div>
      )}

      {/* Footer: timestamp + quick actions */}
      <div className="flex items-center justify-between border-t border-border/60 px-3 py-1.5">
        <p className={cn('text-[10px]', isStalled ? 'font-medium text-amber-600' : 'text-muted-foreground/70')}>
          {refDate ? `há ${formatDistanceToNow(new Date(refDate), { locale: ptBR })}` : 'sem atividade'}
        </p>
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover/card:opacity-100">
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
