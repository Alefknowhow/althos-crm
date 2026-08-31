import { listConversations, getConversationMessages, getSocialConversationContext } from '@/actions/social-inbox'
import { getCurrentOrganization } from '@/lib/supabase/types'
import { listOrgMembers } from '@/actions/team'
import { listEmailTemplates } from '@/actions/emails'
import SocialInbox from '@/components/features/social/SocialInbox'

export const dynamic = 'force-dynamic'

export default async function SocialInboxPage({
  params,
  searchParams,
}: {
  params: { orgSlug: string }
  searchParams: { id?: string; connected?: string }
}) {
  const org = await getCurrentOrganization(params.orgSlug)
  const conversations = await listConversations(params.orgSlug)
  const selectedConversation = searchParams.id
    ? conversations.find(c => c.id === searchParams.id) || null
    : null
  const messages = selectedConversation
    ? await getConversationMessages(params.orgSlug, selectedConversation.id)
    : []

  // Alimenta o painel "Detalhes do lead" (mesma estrutura tabulada do painel
  // do WhatsApp) — membros pro seletor de responsável, contexto do lead
  // vinculado (se houver) e templates de e-mail pro botão "Enviar e-mail".
  const members = await listOrgMembers(params.orgSlug)
  const emailTemplates = await listEmailTemplates(params.orgSlug)
  const panelContext = selectedConversation
    ? await getSocialConversationContext(params.orgSlug, selectedConversation.id)
    : null

  return (
    <div className="h-full flex bg-background overflow-hidden">
      <SocialInbox
        orgSlug={params.orgSlug}
        orgId={org.id}
        conversations={conversations}
        selectedConversation={selectedConversation}
        initialMessages={messages}
        justConnected={searchParams.connected === '1'}
        members={members}
        panelContext={panelContext}
        emailTemplates={emailTemplates}
        orgName={org.name}
      />
    </div>
  )
}
