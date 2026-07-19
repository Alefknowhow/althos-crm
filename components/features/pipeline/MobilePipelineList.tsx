'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  ChevronDown,
  ChevronRight,
  Plus,
  MessageCircle,
  Mail,
  Sparkles,
  UserCheck,
} from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import LeadFormResponsesButton from '../LeadFormResponsesButton'
import type { CardMember } from '../LeadCard'

// ── Helpers (mirrored from LeadCard so the mobile card stays self-contained) ──
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

const STALL_MS = 7 * 24 * 60 * 60 * 1000

// ── Compact lead card (mobile) ───────────────────────────────────────────────
function MobileLeadCard({
  lead,
  orgSlug,
  owner,
  color,
  onClick,
}: {
  lead: any
  orgSlug: string
  owner?: CardMember | null
  color: string
  onClick: () => void
}) {
  const refDate = lead.last_activity_at || lead.updated_at
  const isStalled = refDate ? Date.now() - new Date(refDate).getTime() > STALL_MS : false
  const tags: string[] = lead.tags || []
  const visibleTags = tags.slice(0, 3)
  const extraTags = tags.length - visibleTags.length
  const tier = lead.ai_tier ? TIER[String(lead.ai_tier).toLowerCase() as keyof typeof TIER] : null
  const phoneDigits = onlyDigits(lead.phone)

  function stop(e: React.MouseEvent) {
    e.stopPropagation()
  }

  return (
    <div
      onClick={onClick}
      className="rounded-lg border bg-background p-3 active:bg-muted/40 transition-colors"
      style={{ boxShadow: `inset 3px 0 0 0 ${color}` }}
    >
      {/* Title + responsável */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-snug text-foreground line-clamp-2">{lead.name}</p>
        {owner && (
          <span
            title={owner.name || owner.email}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700"
          >
            {initials(owner.name, owner.email)}
          </span>
        )}
      </div>

      {/* Value */}
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
        {formatCurrency(lead.value_cents || 0)}
      </p>

      {/* Badges / tags */}
      {(tier || lead.status === 'cliente' || tags.length > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
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
              className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground max-w-[90px] truncate"
              title={t}
            >
              {t}
            </span>
          ))}
          {extraTags > 0 && <span className="text-[10px] text-muted-foreground">+{extraTags}</span>}
        </div>
      )}

      {/* Footer: last activity + always-visible shortcuts */}
      <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2">
        <p className={cn('text-[10px]', isStalled ? 'font-medium text-amber-600' : 'text-muted-foreground/70')}>
          {refDate ? `há ${formatDistanceToNow(new Date(refDate), { locale: ptBR })}` : 'sem atividade'}
        </p>
        <div className="flex items-center gap-1" onClick={stop}>
          <LeadFormResponsesButton orgSlug={orgSlug} leadId={lead.id} />
          {phoneDigits && (
            <a
              href={`https://wa.me/${phoneDigits}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Conversa no WhatsApp"
              className="flex h-7 w-7 items-center justify-center rounded-md text-emerald-600 hover:bg-emerald-50"
            >
              <MessageCircle className="h-4 w-4" />
            </a>
          )}
          {lead.email && (
            <a
              href={`mailto:${lead.email}`}
              title="Enviar e-mail"
              className="flex h-7 w-7 items-center justify-center rounded-md text-sky-600 hover:bg-sky-50"
            >
              <Mail className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Stage accordion (mobile) ─────────────────────────────────────────────────
export default function MobilePipelineList({
  stages,
  leads,
  orgSlug,
  membersById,
  onLeadClick,
  onAddLead,
}: {
  stages: any[]
  leads: any[]
  orgSlug: string
  membersById: Record<string, CardMember>
  onLeadClick: (id: string) => void
  onAddLead: (stageId: string) => void
}) {
  // First stage open by default so the screen isn't empty on entry.
  const [openStage, setOpenStage] = useState<string | null>(stages[0]?.id ?? null)

  return (
    <div className="flex-1 overflow-y-auto space-y-2 pb-4 hide-scrollbar">
      {stages.map(stage => {
        const stageLeads = leads.filter(l => l.stage_id === stage.id)
        const total = stageLeads.reduce((a, l) => a + (l.value_cents || 0), 0)
        const color = stage.color || '#94a3b8'
        const isOpen = openStage === stage.id

        return (
          <div key={stage.id} className="overflow-hidden rounded-none border bg-card">
            {/* Stage row — colour matches the stage */}
            <button
              type="button"
              onClick={() => setOpenStage(isOpen ? null : stage.id)}
              className="flex w-full items-center gap-2.5 px-3 py-3 text-left"
              style={{ backgroundColor: `${color}14`, boxShadow: `inset 4px 0 0 0 ${color}` }}
            >
              <span className="text-muted-foreground shrink-0">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                  <span className="truncate">{stage.name}</span>
                </div>
                <div className="mt-0.5 text-xs tabular-nums text-muted-foreground">{formatCurrency(total)}</div>
              </div>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                {stageLeads.length}
              </span>
            </button>

            {/* Expanded lead cards */}
            {isOpen && (
              <div className="space-y-2 bg-muted/20 p-2">
                {stageLeads.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => onAddLead(stage.id)}
                    className="flex w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border py-6 text-xs text-muted-foreground/70 transition-colors active:border-brand-300 active:text-brand-600"
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar lead
                  </button>
                ) : (
                  <>
                    {stageLeads.map(lead => (
                      <MobileLeadCard
                        key={lead.id}
                        lead={lead}
                        orgSlug={orgSlug}
                        owner={lead.assigned_to ? membersById[lead.assigned_to] : null}
                        color={color}
                        onClick={() => onLeadClick(lead.id)}
                      />
                    ))}
                    <button
                      type="button"
                      onClick={() => onAddLead(stage.id)}
                      className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-border py-2.5 text-xs text-muted-foreground/70 transition-colors active:border-brand-300 active:text-brand-600"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Adicionar lead
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
