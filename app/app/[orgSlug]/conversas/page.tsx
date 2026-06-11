import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import { listOrgMembers } from '@/actions/team'
import { getConversationContext } from '@/actions/whatsapp'
import WhatsappChat from '@/components/features/WhatsappChat'

export default async function ConversasPage({ params, searchParams }: { params: { orgSlug: string }, searchParams: { id?: string, lead?: string } }) {
  const org = await getCurrentOrganization(params.orgSlug)
  const supabase = createClient()

  const { data: conversations } = await supabase
    .from('whatsapp_conversations')
    .select('*, leads(id, name, assigned_to, pipeline_stages(name))')
    .eq('organization_id', org.id)
    .order('last_message_at', { ascending: false })

  // Team members power both the inbox agent-color tags and the side panel selectors.
  const members = await listOrgMembers(params.orgSlug)

  let selectedConversation = null
  let messages: any[] = []
  let panelContext: any = null

  // Resolve the conversation: by explicit conversation id, or by lead id (deep-link
  // from a pipeline lead card → opens that lead's most recent conversation).
  if (searchParams.id) {
    selectedConversation = conversations?.find(c => c.id === searchParams.id) || null
  } else if (searchParams.lead) {
    selectedConversation = conversations?.find(c => c.lead_id === searchParams.lead) || null
  }

  {
    if (selectedConversation) {
      const { data: msgs } = await supabase.from('whatsapp_messages').select('*').eq('conversation_id', selectedConversation.id).order('created_at', { ascending: true })
      messages = msgs || []
      panelContext = await getConversationContext(params.orgSlug, selectedConversation.id)
    }
  }

  return (
    <div className="h-[calc(100vh-4rem)] -m-6 flex bg-background overflow-hidden">
      <WhatsappChat
        orgSlug={params.orgSlug}
        orgId={org.id}
        conversations={conversations || []}
        selectedConversation={selectedConversation}
        initialMessages={messages}
        members={members}
        panelContext={panelContext}
        isMock={!org.whatsapp_access_token || org.whatsapp_access_token === 'mock'}
      />
    </div>
  )
}
