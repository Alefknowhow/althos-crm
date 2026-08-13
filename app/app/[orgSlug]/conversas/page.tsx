import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import { listOrgMembers } from '@/actions/team'
import { getConversationContext, listScheduledMessages } from '@/actions/whatsapp'
import { getWaTemplates } from '@/actions/whatsapp-templates'
import WhatsappChat from '@/components/features/WhatsappChat'

export default async function ConversasPage({ params, searchParams }: { params: { orgSlug: string }, searchParams: { id?: string, lead?: string } }) {
  const org = await getCurrentOrganization(params.orgSlug)
  const supabase = createClient()

  const { data: conversations } = await supabase
    .from('whatsapp_conversations')
    .select('*, contatos(id, name, avatar_url, assigned_to, stage_id, pipeline_id, pipeline_stages(name))')
    .eq('organization_id', org.id)
    .order('last_message_at', { ascending: false })

  // Team members power both the inbox agent-color tags and the side panel selectors.
  const members = await listOrgMembers(params.orgSlug)

  // Etapas de todos os pipelines da org — alimenta o dropdown de troca rápida
  // de etapa direto na lista de conversas. pipeline_stages não tem
  // organization_id direto, então filtra via join com pipelines.
  const { data: pipelineStages } = await supabase
    .from('pipeline_stages')
    .select('id, name, pipeline_id, position, pipelines!inner(organization_id)')
    .eq('pipelines.organization_id', org.id)
    .order('position', { ascending: true })

  // Templates aprovados servem de fallback quando a janela de 24h está fechada.
  const templates = await getWaTemplates(params.orgSlug)

  let selectedConversation = null
  let messages: any[] = []
  let panelContext: any = null
  let scheduled: any[] = []

  // Resolve the conversation: by explicit conversation id, or by lead id (deep-link
  // from a pipeline lead card → opens that lead's most recent conversation).
  if (searchParams.id) {
    selectedConversation = conversations?.find(c => c.id === searchParams.id) || null
  } else if (searchParams.lead) {
    selectedConversation = conversations?.find(c => c.contato_id === searchParams.lead) || null
  }

  {
    if (selectedConversation) {
      const { data: msgs } = await supabase.from('whatsapp_messages').select('*').eq('conversation_id', selectedConversation.id).order('created_at', { ascending: true })
      messages = msgs || []
      panelContext = await getConversationContext(params.orgSlug, selectedConversation.id)
      scheduled = await listScheduledMessages(params.orgSlug, selectedConversation.id)
    }
  }

  return (
    <div className="-mx-6 -mb-6 mt-[3px] flex-1 min-h-0 flex bg-background overflow-hidden">
      <WhatsappChat
        orgSlug={params.orgSlug}
        orgId={org.id}
        conversations={conversations || []}
        selectedConversation={selectedConversation}
        initialMessages={messages}
        members={members}
        pipelineStages={(pipelineStages || []).map(s => ({ id: s.id, name: s.name, pipeline_id: s.pipeline_id, position: s.position }))}
        panelContext={panelContext}
        scheduled={scheduled}
        templates={templates}
        isMock={!org.whatsapp_access_token || org.whatsapp_access_token === 'mock'}
      />
    </div>
  )
}
