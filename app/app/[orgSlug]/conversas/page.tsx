import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import { listOrgMembers } from '@/actions/team'
import { getConversationContext, listScheduledMessages } from '@/actions/whatsapp'
import { getWaTemplates } from '@/actions/whatsapp-templates'
import { getObjectSignedUrls } from '@/actions/storage'
import WhatsappChat from '@/components/features/WhatsappChat'

export default async function ConversasPage({ params, searchParams }: { params: { orgSlug: string }, searchParams: { id?: string, lead?: string } }) {
  const org = await getCurrentOrganization(params.orgSlug)
  const supabase = createClient()

  // Trava um teto — antes carregava a tabela inteira. 300 conversas mais
  // recentes cobre qualquer uso real de inbox; se a organização crescer além
  // disso, a lista passa a precisar de paginação/scroll incremental de
  // verdade (fica pro próximo passo, quando o volume justificar).
  const { data: conversationsRaw } = await supabase
    .from('whatsapp_conversations')
    .select('*, contatos(id, name, avatar_url, avatar_storage_object_id, assigned_to, stage_id, pipeline_id, pipeline_stages(name))')
    .eq('organization_id', org.id)
    .order('last_message_at', { ascending: false })
    .limit(300)

  // Resolve avatar do contato (R2, signed URL) numa chamada em lote — o
  // join acima só traz avatar_url legado (Supabase Storage) ou
  // avatar_storage_object_id (R2); aqui a gente substitui pela URL final,
  // igual acontece em contatos/page.tsx.
  const avatarObjectIds = (conversationsRaw || [])
    .map(c => (c as any).contatos?.avatar_storage_object_id)
    .filter((id): id is string => !!id)
  const avatarUrls = avatarObjectIds.length > 0
    ? await getObjectSignedUrls(params.orgSlug, avatarObjectIds)
    : new Map<string, string>()
  const conversations = (conversationsRaw || []).map(c => {
    const contato = (c as any).contatos
    if (contato?.avatar_storage_object_id && avatarUrls.has(contato.avatar_storage_object_id)) {
      return { ...c, contatos: { ...contato, avatar_url: avatarUrls.get(contato.avatar_storage_object_id) } }
    }
    return c
  })

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

  // Se o Agente IA está ligado globalmente pra essa org — controla se o
  // toggle "IA nesta conversa" aparece no cabeçalho do chat (não faz
  // sentido oferecer pausar/retomar IA por conversa se ela está desligada
  // pra todo mundo).
  const { data: attendantConfig } = await supabase
    .from('ai_attendant_config')
    .select('is_enabled')
    .eq('organization_id', org.id)
    .maybeSingle()
  const aiEnabledGlobally = attendantConfig?.is_enabled ?? false

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
      // Últimas 500 mensagens (busca desc + limit, depois reordena pra
      // exibição) — antes carregava o histórico inteiro da thread de uma vez.
      const { data: msgs } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('conversation_id', selectedConversation.id)
        .order('created_at', { ascending: false })
        .limit(500)
      messages = (msgs || []).reverse()
      panelContext = await getConversationContext(params.orgSlug, selectedConversation.id)
      scheduled = await listScheduledMessages(params.orgSlug, selectedConversation.id)
    }
  }

  return (
    <div className="-mx-3 sm:-mx-5 -mb-5 flex-1 min-h-0 flex bg-background overflow-hidden">
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
        aiEnabledGlobally={aiEnabledGlobally}
      />
    </div>
  )
}
