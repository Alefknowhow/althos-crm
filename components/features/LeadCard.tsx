'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useState, useRef } from 'react'
import { updateLeadValue } from '@/actions/leads'

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
        className="w-full text-xs font-medium border border-primary rounded px-1.5 py-0.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary tabular-nums"
        placeholder="0"
      />
    )
  }

  return (
    <button
      type="button"
      onPointerDown={e => e.stopPropagation()}
      onClick={open}
      className={`text-xs font-medium transition-colors ${
        localCents
          ? 'text-foreground hover:text-primary'
          : 'text-muted-foreground/50 hover:text-muted-foreground'
      }`}
    >
      {display}
    </button>
  )
}

// ── Main card ──────────────────────────────────────────────────────────────────
export default function LeadCard({
  lead,
  orgSlug,
  isOverlay,
  onClick,
}: {
  lead: any
  orgSlug: string
  isOverlay?: boolean
  onClick?: () => void
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

  const isStalled =
    Date.now() - new Date(lead.updated_at).getTime() > 7 * 24 * 60 * 60 * 1000

  const tags: string[] = lead.tags || []
  const visibleTags = tags.slice(0, 2)
  const extraTags = tags.length - visibleTags.length

  return (
    <div
      ref={isOverlay ? null : setNodeRef}
      style={isOverlay ? undefined : style}
      {...attributes}
      /* ↑ attributes go on outer div (for a11y), but NOT listeners */
      className={`bg-background border rounded-xl shadow-sm select-none transition-all ${
        isOverlay
          ? 'shadow-xl rotate-1 scale-[1.02]'
          : 'hover:border-primary/40 hover:shadow-md'
      } ${isDragging ? 'opacity-30' : ''}`}
    >
      {/* ── Drag handle area — only this region triggers drag ── */}
      <div
        {...listeners}
        onClick={() => onClick?.()}
        className="px-3 pt-3 pb-2 cursor-grab active:cursor-grabbing"
      >
        <p className="text-sm font-semibold leading-snug text-foreground line-clamp-2">
          {lead.name}
        </p>
      </div>

      {/* ── Interactive area — pointer events free from dnd ── */}
      <div className="px-3 pb-3 space-y-2">
        {/* Value */}
        <ValueEditor lead={lead} orgSlug={orgSlug} />

        {/* Tags row */}
        {(tags.length > 0 || isStalled) && (
          <div className="flex items-center gap-1 overflow-hidden">
            {isStalled && (
              <span className="inline-flex items-center rounded-full bg-destructive/10 px-1.5 py-0.5 text-[9px] font-semibold text-destructive uppercase tracking-wide shrink-0">
                parado
              </span>
            )}
            {visibleTags.map(t => (
              <span
                key={t}
                className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground shrink-0 max-w-[70px] truncate"
                title={t}
              >
                {t}
              </span>
            ))}
            {extraTags > 0 && (
              <span className="text-[10px] text-muted-foreground shrink-0">+{extraTags}</span>
            )}
          </div>
        )}

        {/* Footer: timestamp */}
        <p className="text-[10px] text-muted-foreground/60">
          Há {formatDistanceToNow(new Date(lead.updated_at), { locale: ptBR })}
        </p>
      </div>
    </div>
  )
}
