'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Mail } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { createLeadFromSocialConversation } from '@/actions/social-inbox'
import SendEmailDialog from '@/components/features/SendEmailDialog'
import LeadDataTab, { type Member, type Stage } from '@/components/features/lead-panel/LeadDataTab'
import LeadDealsTab from '@/components/features/lead-panel/LeadDealsTab'
import LeadFlowsTab from '@/components/features/lead-panel/LeadFlowsTab'
import LeadTasksTab from '@/components/features/lead-panel/LeadTasksTab'
import { agentColor, memberInitials } from '@/components/features/ConversationDetailPanel'

/**
 * Painel de detalhes do lead para o inbox do Instagram — mesma estrutura
 * (Dados/Negociações/Anotações/Atividades) do painel do WhatsApp
 * (ConversationDetailPanel.tsx), reaproveitando os mesmos componentes de aba
 * em components/features/lead-panel/. Só muda o cabeçalho/rail de colapso e
 * como o lead é criado/vinculado à conversa (createLeadFromSocialConversation,
 * que também copia a foto de perfil do Instagram pro avatar do lead).
 */
export default function SocialLeadDetailPanel({
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
  templates?: any[]
  orgName?: string
  open: boolean
  onToggle: () => void
}) {
  const router = useRouter()
  const lead = context?.lead ?? null
  const stages: Stage[] = context?.stages ?? []
  const [creating, setCreating] = useState(false)

  const responsibleId: string | null = lead?.assigned_to ?? null

  async function handleCreateLead() {
    setCreating(true)
    const res = await createLeadFromSocialConversation(orgSlug, conversation.id)
    if (!res.ok) toast.error('Não foi possível criar o lead', { description: (res as any).error })
    else toast.success('Lead criado e vinculado à conversa')
    setCreating(false)
    router.refresh()
  }

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
