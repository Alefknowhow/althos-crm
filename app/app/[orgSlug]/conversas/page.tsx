import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import WhatsappChat from '@/components/features/WhatsappChat'

export default async function ConversasPage({ params, searchParams }: { params: { orgSlug: string }, searchParams: { id?: string } }) {
  const org = await getCurrentOrganization(params.orgSlug)
  const supabase = createClient()
  
  const { data: conversations } = await supabase.from('whatsapp_conversations').select('*, leads(id, name)').eq('organization_id', org.id).order('last_message_at', { ascending: false })

  let selectedConversation = null
  let messages: any[] = []
  
  if (searchParams.id) {
    selectedConversation = conversations?.find(c => c.id === searchParams.id) || null
    if (selectedConversation) {
      const { data: msgs } = await supabase.from('whatsapp_messages').select('*').eq('conversation_id', selectedConversation.id).order('created_at', { ascending: true })
      messages = msgs || []
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
        isMock={!org.whatsapp_access_token || org.whatsapp_access_token === 'mock'}
      />
    </div>
  )
}
