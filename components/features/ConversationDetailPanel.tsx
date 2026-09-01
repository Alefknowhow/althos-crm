'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Mail, Sparkles, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { createLeadFromConversation, dismissHandoffSummary } from '@/actions/whatsapp'
import SendEmailDialog from '@/components/features/SendEmailDialog'
import LeadDataTab, { type Member, type Stage } from '@/components/features/lead-panel/LeadDataTab'
import LeadDealsTab from '@/components/features/lead-panel/LeadDealsTab'
import LeadFlowsTab from '@/components/features/lead-panel/LeadFlowsTab'
import LeadTasksTab from '@/components/features/lead-panel/LeadTasksTab'

// 8 deterministic agent colors, indexed by a hash of the user id so the same
// atendente always gets the same color across the inbox and the panel.
const AGENT_COLORS = [
  'bg-rose-500', 'bg-amber-500', 'bg-emerald-500', 'bg-sky-500',
  'bg-violet-500', 'bg-pink-500', 'bg-teal-500', 'bg-orange-500',
]

export function agentColor(userId: string | null | undefined): string {
  if (!userId) return 'bg-muted-foreground/40'
  let h = 0
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0
  return AGENT_COLORS[h % AGENT_COLORS.length]
}

export function memberInitials(name?: string, email?: string): string {
  const base = name?.trim() || email?.split('@')[0] || '?'
  const parts = base.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return base.slice(0, 2).toUpperCase()
}

/** "Emili Segabinazzi" -> "Emili S." — nome completo curto pra caber numa
 *  etiqueta de largura fixa, mais legível que as duas iniciais soltas. */
export function memberShortLabel(name?: string, email?: string): string {
  const base = name?.trim() || email?.split('@')[0] || 'Sem resp.'
  const parts = base.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0]} ${parts[1][0].toUpperCase()}.`
  return parts[0] || 'Sem resp.'
}

export default function ConversationDetailPanel({
  orgSlug,
  conversation,
  context,
  members,
  templates,
  orgName,
  open,
  onToggle,
}: {
  orgSlug: string
  conversation: any
  context: any
  members: Member[]
  /** Templates de e-mail — alimenta o botão "Enviar e-mail" (SendEmailDialog).
   *  Opcional: se omitido, o botão simplesmente não aparece. */
  templates?: any[]
  orgName?: string
  open: boolean
  onToggle: () => void
}) {
  const router = useRouter()
  const lead = context?.lead ?? null
  const stages: Stage[] = context?.stages ?? []

  const [creating, setCreating] = useState(false)
  const [dismissingSummary, setDismissingSummary] = useState(false)

  // Responsável único: dono do lead (contatos.assigned_to) — não existe mais
  // um responsável separado "pelo atendimento" da conversa.
  const responsibleId: string | null = lead?.assigned_to ?? null

  async function handleDismissSummary() {
    setDismissingSummary(true)
    const res = await dismissHandoffSummary(orgSlug, conversation.id)
    setDismissingSummary(false)
    if ((res as any)?.ok === false) toast.error('Não foi possível dispensar o resumo')
    else router.refresh()
  }

  async function handleCreateLead() {
    setCreating(true)
    const res = await createLeadFromConversation(orgSlug, conversation.id)
    if (!res.ok) toast.error('Não foi possível criar o lead', { description: res.error })
    else toast.success('Lead criado e vinculado à conversa')
    setCreating(false)
    router.refresh()
  }

  // Collapsed rail: a thin strip with just the expand button.
  if (!open) {
    return (
      <div className="hidden lg:flex flex-col items-center w-12 border-l bg-background shrink-0">
        <button
          type="button"
          onClick={onToggle}
          className="mt-4 p-2 rounded-md hover:bg-muted text-muted-foreground"
          title="Expandir painel do lead"
          aria-label="Expandir painel do lead"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        {conversation?.ai_handoff_summary && (
          <div className="mt-2 text-primary" title="Tem um resumo da IA — abra o painel">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
        )}
        {responsibleId && (
          <div
            className={`mt-3 h-7 w-7 rounded-full ${agentColor(responsibleId)} text-white text-[10px] font-semibold flex items-center justify-center`}
            title="Responsável"
          >
            {(() => { const m = members.find(x => x.user_id === responsibleId); return memberInitials(m?.name, m?.email) })()}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="hidden lg:flex flex-col w-80 xl:w-96 border-l bg-background shrink-0 overflow-hidden">
      <div className="h-16 px-4 border-b flex items-center justify-between shrink-0 gap-2">
        <span className="font-semibold text-sm">Detalhes do lead</span>
        <div className="flex items-center gap-1 shrink-0">
          {lead?.email && templates && (
            <SendEmailDialog
              orgSlug={orgSlug}
              lead={lead}
              templates={templates}
              org={{ name: orgName }}
              trigger={
                <button
                  type="button"
                  className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
                  title="Enviar e-mail"
                  aria-label="Enviar e-mail"
                >
                  <Mail className="h-4 w-4" />
                </button>
              }
            />
          )}
          <button
            type="button"
            onClick={onToggle}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
            title="Retrair painel"
            aria-label="Retrair painel"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
        {conversation?.ai_handoff_summary && (
          <section className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                <Sparkles className="h-3 w-3" /> Resumo da IA
              </h4>
              <button
                type="button"
                onClick={handleDismissSummary}
                disabled={dismissingSummary}
                title="Dispensar resumo"
                aria-label="Dispensar resumo"
                className="text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="whitespace-pre-wrap text-xs leading-relaxed">{conversation.ai_handoff_summary}</p>
          </section>
        )}
        {!lead ? (
          <section className="space-y-3 rounded-lg border border-dashed p-4 text-center">
            <p className="text-muted-foreground text-xs">Esta conversa ainda não tem um lead vinculado.</p>
            <Button type="button" size="sm" onClick={handleCreateLead} disabled={creating} className="w-full">
              {creating ? 'Criando...' : 'Criar lead a partir do contato'}
            </Button>
          </section>
        ) : (
          <Tabs defaultValue="dados">
            <TabsList className="grid grid-cols-4 h-auto">
              <TabsTrigger value="dados" className="text-[11px] px-1 py-1.5">Dados</TabsTrigger>
              <TabsTrigger value="negociacoes" className="text-[11px] px-1 py-1.5">Negociações</TabsTrigger>
              <TabsTrigger value="anotacoes" className="text-[11px] px-1 py-1.5">Fluxos</TabsTrigger>
              <TabsTrigger value="atividades" className="text-[11px] px-1 py-1.5">Atividades</TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="pt-4">
              <LeadDataTab
                orgSlug={orgSlug}
                lead={lead}
                fallbackPhone={conversation?.contact_phone}
                stages={stages}
                members={members}
                leadHref={`/app/${orgSlug}/contatos/${lead.id}`}
              />
            </TabsContent>

            <TabsContent value="negociacoes" className="pt-4">
              <LeadDealsTab orgSlug={orgSlug} leadId={lead.id} />
            </TabsContent>

            <TabsContent value="anotacoes" className="pt-4">
              <LeadFlowsTab orgSlug={orgSlug} leadId={lead.id} />
            </TabsContent>

            <TabsContent value="atividades" className="pt-4">
              <LeadTasksTab orgSlug={orgSlug} leadId={lead.id} leadName={lead.name} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  )
}
