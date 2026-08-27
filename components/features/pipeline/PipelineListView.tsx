'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronRight, Plus, Mail } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import LeadFormResponsesButton from '../LeadFormResponsesButton'
import LeadProposalsButton from '../LeadProposalsButton'
import {
  StagePicker, SellerPicker, ValueEditor, TagEditor, OpenWabaButton,
  WhatsAppGlyph, TIER, onlyDigits, type CardMember,
} from '../LeadCard'

/**
 * Uma linha por lead, com todo o conteúdo que existia no card (valor,
 * responsável, tags, badges, ações rápidas) distribuído horizontalmente —
 * inclusive o StagePicker (etiqueta do estágio clicável pra mover o lead).
 */
function ListLeadRow({
  lead, orgSlug, stages, members, onStageChange, onClick, staleDays,
}: {
  lead: any
  orgSlug: string
  stages: any[]
  members: CardMember[]
  onStageChange: (leadId: string, stageId: string) => void
  onClick: () => void
  staleDays: number
}) {
  const refDate = lead.last_activity_at || lead.updated_at
  const isStalled = refDate ? Date.now() - new Date(refDate).getTime() > staleDays * 24 * 60 * 60 * 1000 : false
  const [tags, setTags] = useState<string[]>(lead.tags || [])
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
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border/60 px-3 py-2 cursor-pointer transition-colors hover:bg-muted/30"
    >
      <StagePicker lead={lead} stages={stages} onPick={stageId => onStageChange(lead.id, stageId)} />

      <p className="min-w-[140px] flex-1 truncate text-sm font-medium text-foreground">{lead.name || 'Sem nome'}</p>

      <div onClick={stop} className="shrink-0">
        <ValueEditor lead={lead} orgSlug={orgSlug} />
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {tier && (
          <span className={cn('inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold', tier.cls)}>
            {tier.label}
          </span>
        )}
        {lead.status === 'cliente' && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
            Cliente
          </span>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1" onClick={stop}>
        {visibleTags.map(t => (
          <span key={t} className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground max-w-[90px] truncate" title={t}>
            {t}
          </span>
        ))}
        {extraTags > 0 && <span className="text-[10px] text-muted-foreground">+{extraTags}</span>}
        <TagEditor lead={lead} orgSlug={orgSlug} tags={tags} onChange={setTags} />
      </div>

      <div onClick={stop} className="shrink-0">
        <SellerPicker lead={lead} orgSlug={orgSlug} members={members} />
      </div>

      <p className={cn('w-24 shrink-0 text-right text-[11px]', isStalled ? 'font-medium text-amber-600' : 'text-muted-foreground/70')}>
        {refDate ? `há ${formatDistanceToNow(new Date(refDate), { locale: ptBR })}` : 'sem atividade'}
      </p>

      <div className="flex shrink-0 items-center gap-0.5" onClick={stop}>
        <LeadFormResponsesButton orgSlug={orgSlug} leadId={lead.id} />
        <LeadProposalsButton orgSlug={orgSlug} leadId={lead.id} />
        <OpenWabaButton orgSlug={orgSlug} leadId={lead.id} />
        {phoneDigits && (
          <a
            href={`https://wa.me/${phoneDigits}`}
            target="_blank"
            rel="noopener noreferrer"
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
            onClick={stop}
            title="E-mail"
            className="flex h-6 w-6 items-center justify-center rounded-md text-sky-600 hover:bg-sky-50"
          >
            <Mail className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </div>
  )
}

/** Modo lista do pipeline — estágios resumidos em uma linha expansível, cada
 * uma revelando os leads daquele estágio (mesmo espírito do accordion
 * mobile), com o conteúdo do card distribuído horizontalmente por linha. */
export default function PipelineListView({
  stages, leads, orgSlug, members, onLeadClick, onAddLead, onStageChange, staleDays = 7,
}: {
  stages: any[]
  leads: any[]
  orgSlug: string
  members: CardMember[]
  onLeadClick: (id: string) => void
  onAddLead: (stageId: string) => void
  onStageChange: (leadId: string, stageId: string) => void
  staleDays?: number
}) {
  const [openStages, setOpenStages] = useState<Set<string>>(() => new Set(stages[0] ? [stages[0].id] : []))

  function toggle(stageId: string) {
    setOpenStages(prev => {
      const next = new Set(prev)
      if (next.has(stageId)) next.delete(stageId)
      else next.add(stageId)
      return next
    })
  }

  return (
    <div className="flex-1 overflow-y-auto rounded-none border border-border bg-card hide-scrollbar">
      {stages.map(stage => {
        const stageLeads = leads.filter(l => l.stage_id === stage.id)
        const total = stageLeads.reduce((a, l) => a + (l.value_cents || 0), 0)
        const color = stage.color || '#94a3b8'
        const isOpen = openStages.has(stage.id)

        return (
          <div key={stage.id} className="border-b border-border last:border-b-0">
            <button
              type="button"
              onClick={() => toggle(stage.id)}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left"
              style={{ backgroundColor: `${color}14`, boxShadow: `inset 4px 0 0 0 ${color}` }}
            >
              <span className={cn('shrink-0 text-muted-foreground transition-transform duration-200', isOpen ? 'rotate-90' : 'rotate-0')}>
                <ChevronRight className="h-4 w-4" />
              </span>
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-sm font-semibold text-foreground">{stage.name}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{formatCurrency(total)}</span>
              <span className="ml-auto shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                {stageLeads.length}
              </span>
            </button>

            {isOpen && (
              <div className="bg-muted/10">
                {stageLeads.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => onAddLead(stage.id)}
                    className="flex w-full items-center justify-center gap-1 py-4 text-xs text-muted-foreground/70 transition-colors hover:text-brand-600"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Adicionar lead
                  </button>
                ) : (
                  <>
                    {stageLeads.map(lead => (
                      <ListLeadRow
                        key={lead.id}
                        lead={lead}
                        orgSlug={orgSlug}
                        stages={stages}
                        members={members}
                        onStageChange={onStageChange}
                        onClick={() => onLeadClick(lead.id)}
                        staleDays={staleDays}
                      />
                    ))}
                    <button
                      type="button"
                      onClick={() => onAddLead(stage.id)}
                      className="flex w-full items-center justify-center gap-1 py-2 text-xs text-muted-foreground/70 transition-colors hover:text-brand-600"
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
