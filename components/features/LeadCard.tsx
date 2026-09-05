'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { updateLeadValue, updateLeadTags } from '@/actions/contatos'
import { getOrCreateConversationForLead } from '@/actions/whatsapp'
import { cn } from '@/lib/utils'
import { Mail, UserCheck, Sparkles, X } from 'lucide-react'
import LeadFormResponsesButton from './LeadFormResponsesButton'
import LeadProposalsButton from './LeadProposalsButton'
import { SellerPicker, TagEditor, StagePicker } from './LeadCardPickers'

export { SellerPicker, TagEditor, StagePicker }

// Ícone do WhatsApp (lucide-react não tem) — mesmo traçado usado na Sidebar,
// mas com a cor controlada via `fill` pra distinguir os dois botões:
// "Iniciar Waba" (chat dentro do CRM, na API oficial) fica azul; "WhatsApp"
// (abre o app normal, fora do CRM) fica verde, a cor de sempre do WhatsApp.
export function WhatsAppGlyph({ color }: { color: string }) {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill={color}>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.92 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 1.67c2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.42 5.82c0 4.55-3.7 8.25-8.25 8.25a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.18 8.18 0 0 1-1.26-4.4c0-4.55 3.7-8.24 8.25-8.24Zm-4.53 4.6c-.17 0-.44.06-.67.32-.23.25-.87.85-.87 2.08 0 1.22.89 2.4 1.01 2.57.13.17 1.75 2.67 4.25 3.74.59.26 1.06.41 1.42.52.6.19 1.14.16 1.57.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.15-1.18-.06-.1-.23-.16-.48-.28-.25-.13-1.47-.73-1.7-.81-.23-.08-.4-.13-.56.13-.17.25-.64.81-.79.98-.14.17-.29.19-.54.06-.25-.13-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.44.12-.14.16-.25.24-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.37-.78-1.87-.2-.49-.41-.42-.56-.43-.14-.01-.31-.01-.48-.01Z" />
    </svg>
  )
}

// Botão "Iniciar Waba" — abre a conversa desse lead dentro do CRM (API
// oficial); se ainda não existe uma, cria na hora (sem mandar mensagem) e
// já leva pro chat pronto pra digitar.
export function OpenWabaButton({ orgSlug, leadId }: { orgSlug: string; leadId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    e.preventDefault()
    if (loading) return
    setLoading(true)
    const res = await getOrCreateConversationForLead(orgSlug, leadId)
    setLoading(false)
    if (!res.ok) { toast.error(res.error); return }
    router.push(`/app/${orgSlug}/conversas?id=${res.conversationId}`)
  }

  return (
    <button
      type="button"
      onPointerDown={e => e.stopPropagation()}
      onClick={handleClick}
      disabled={loading}
      title="Iniciar Waba"
      className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-sky-50 disabled:opacity-50"
    >
      <WhatsAppGlyph color="#0a84ff" />
    </button>
  )
}

export type CardMember = { id: string; name: string; email: string }

// ── Inline value editor ────────────────────────────────────────────────────────
export function ValueEditor({ lead, orgSlug }: { lead: any; orgSlug: string }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(lead.value_cents ? String(lead.value_cents / 100) : '')
  const [localCents, setLocalCents] = useState<number | null>(lead.value_cents ?? null)
  const inputRef = useRef<HTMLInputElement>(null)

  const display = localCents
    ? `R$ ${(localCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    : '+ valor'

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
        className="w-20 text-xs font-semibold border border-primary rounded px-1.5 py-0.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary tabular-nums"
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
        'whitespace-nowrap text-xs font-semibold tabular-nums transition-colors',
        localCents ? 'text-foreground hover:text-primary' : 'text-muted-foreground/50 hover:text-muted-foreground',
      )}
    >
      {display}
    </button>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────────
export function initials(name: string, email: string): string {
  const base = name?.trim() || email?.split('@')[0] || '?'
  const parts = base.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return base.slice(0, 2).toUpperCase()
}

export const TIER = {
  hot:    { label: 'Quente', cls: 'bg-rose-100 text-rose-700' },
  quente: { label: 'Quente', cls: 'bg-rose-100 text-rose-700' },
  warm:   { label: 'Morno',  cls: 'bg-amber-100 text-amber-700' },
  morno:  { label: 'Morno',  cls: 'bg-amber-100 text-amber-700' },
  cold:   { label: 'Frio',   cls: 'bg-sky-100 text-sky-700' },
  frio:   { label: 'Frio',   cls: 'bg-sky-100 text-sky-700' },
} as const

export function onlyDigits(s?: string | null) {
  return (s || '').replace(/\D/g, '')
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
  staleDays = 7,
}: {
  lead: any
  orgSlug: string
  isOverlay?: boolean
  onClick?: () => void
  owner?: CardMember | null
  members?: CardMember[]
  stages?: any[]
  onStageChange?: (stageId: string) => void
  staleDays?: number
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
    ? Date.now() - new Date(refDate).getTime() > staleDays * 24 * 60 * 60 * 1000
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
        'group/card relative bg-background border rounded-none   select-none transition-all',
        isOverlay ? '  rotate-1 scale-[1.02]' : 'hover:border-primary/40  ',
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
          <div className="shrink-0 pt-0.5">
            <ValueEditor lead={lead} orgSlug={orgSlug} />
          </div>
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
      </div>

      {/* Badges + tags row */}
      {(tier || lead.status === 'cliente' || tags.length > 0 || !isOverlay) && (
        <div className="relative flex flex-wrap items-center gap-1 px-2.5 pb-1.5">
          {tier && (
            <span className={cn('inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold', tier.cls)}>
              <Sparkles className="h-2.5 w-2.5" />
              {tier.label}
            </span>
          )}
          {lead.status === 'cliente' && (
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
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/card:opacity-100 group-focus-within/card:opacity-100 [@media(hover:none)]:opacity-100">
          {!isOverlay && <LeadFormResponsesButton orgSlug={orgSlug} leadId={lead.id} />}
          {!isOverlay && <LeadProposalsButton orgSlug={orgSlug} leadId={lead.id} />}
          {!isOverlay && (
            <OpenWabaButton orgSlug={orgSlug} leadId={lead.id} />
          )}
          {phoneDigits && (
            <a
              href={`https://wa.me/${phoneDigits}`}
              target="_blank"
              rel="noopener noreferrer"
              onPointerDown={stop}
              onClick={stop}
              title="WhatsApp"
              className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-emerald-50"
            >
              <WhatsAppGlyph color="#25D366" />
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
