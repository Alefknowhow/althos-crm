import { getCurrentOrganization } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import { listOrgMembers } from '@/actions/team'
import { getConversationContext, listScheduledMessages } from '@/actions/whatsapp'
import { getWaTemplates } from '@/actions/whatsapp-templates'
import { listEmailTemplates } from '@/actions/emails'
import { getObjectSignedUrls } from '@/actions/storage'
import { checkFeatureAccessByOrgSlug } from '@/lib/plans/server'
import { listConversations, getConversationMessages, getSocialConversationContext } from '@/actions/social-inbox'
import { listPendingComments } from '@/actions/social-comments'
import WhatsappChat from '@/components/features/WhatsappChat'
import SocialInbox from '@/components/features/social/SocialInbox'
import CommentsInbox from '@/components/features/social/CommentsInbox'
import UnifiedConversasSidebar from '@/components/features/conversas/UnifiedConversasSidebar'
import { mergeConversationsByRecency, type UnifiedConversationRow } from '@/lib/conversas/unify'

/**
 * Inbox unificado — WhatsApp e Instagram (DM) numa lista só, intercalada
 * por atividade recente (não mais abas separadas por canal). Cada canal
 * continua lendo da própria tabela por baixo (whatsapp_conversations vs.
 * social_conversations/social_messages) e mantém seu próprio header/
 * mensagens/composer (lógica de negócio genuinamente diferente por canal:
 * janela de 24h e agendamento só existem no WhatsApp) — só a barra
 * lateral de conversas foi unificada. Comentários do Instagram é feed
 * separado (não é "conversa com uma pessoa"), acessível por ?ch=comentarios.
 */
export default async function ConversasPage({
  params, searchParams,
}: {
  params: { orgSlug: string }
  searchParams: { id?: string; lead?: string; ch?: string; connected?: string }
}) {
  const org = await getCurrentOrganization(params.orgSlug)

  const [planWhatsapp, planInstagram] = await Promise.all([
    checkFeatureAccessByOrgSlug(params.orgSlug, 'whatsapp'),
    checkFeatureAccessByOrgSlug(params.orgSlug, 'instagram_automation'),
  ])

  if (searchParams.ch === 'comentarios' && planInstagram) {
    const comments = await listPendingComments(params.orgSlug)
    return (
      <div className="-mx-3 sm:-mx-5 -mb-5 flex-1 min-h-0 flex flex-col bg-background overflow-hidden">
        <CommentsInbox orgSlug={params.orgSlug} orgId={org.id} initialComments={comments} />
      </div>
    )
  }

  const supabase = createClient()

  // Lista leve de WhatsApp pra sidebar unificada — trava um teto de 300
  // conversas mais recentes (mesmo limite de antes, cobre uso real de inbox).
  const { data: waConversationsRaw } = planWhatsapp ? await supabase
    .from('whatsapp_conversations')
    .select('*, contatos(id, name, avatar_url, avatar_storage_object_id, assigned_to, stage_id, pipeline_id, value_cents, pipeline_stages(name, color))')
    .eq('organization_id', org.id)
    .order('last_message_at', { ascending: false })
    .limit(300) : { data: [] }

  const avatarObjectIds = (waConversationsRaw || [])
    .map(c => (c as any).contatos?.avatar_storage_object_id)
    .filter((id): id is string => !!id)
  const avatarUrls = avatarObjectIds.length > 0
    ? await getObjectSignedUrls(params.orgSlug, avatarObjectIds)
    : new Map<string, string>()
  const waConversations = (waConversationsRaw || []).map(c => {
    const contato = (c as any).contatos
    if (contato?.avatar_storage_object_id && avatarUrls.has(contato.avatar_storage_object_id)) {
      return { ...c, contatos: { ...contato, avatar_url: avatarUrls.get(contato.avatar_storage_object_id) } }
    }
    return c
  })

  const igConversations = planInstagram ? await listConversations(params.orgSlug) : []

  // Responsável/etapa dos contatos do Instagram — o WhatsApp já traz isso
  // no join de cima; aqui é um select à parte pelos poucos contato_id
  // presentes na lista carregada.
  const igContatoIds = igConversations.map(c => c.contato_id).filter((id): id is string => !!id)
  const { data: igContatosRaw } = igContatoIds.length > 0 ? await supabase
    .from('contatos')
    .select('id, assigned_to, pipeline_stages(name, color)')
    .in('id', igContatoIds) : { data: [] }
  const igContatoById = new Map((igContatosRaw || []).map((c: any) => [c.id, c]))

  const members = await listOrgMembers(params.orgSlug)

  const { data: pipelineStages } = await supabase
    .from('pipeline_stages')
    .select('id, name, pipeline_id, position, is_won, is_lost, pipelines!inner(organization_id)')
    .eq('pipelines.organization_id', org.id)
    .order('position', { ascending: true })

  const unifiedRows: UnifiedConversationRow[] = mergeConversationsByRecency(
    waConversations.map((c: any) => ({
      id: c.id,
      channel: 'whatsapp' as const,
      name: c.contatos?.name || c.contact_name || c.contact_phone || 'Contato',
      avatarUrl: c.contatos?.avatar_url ?? null,
      preview: c.last_message_preview ?? null,
      lastMessageAt: c.last_message_at ?? null,
      unreadCount: c.unread_count ?? 0,
      assignedTo: c.contatos?.assigned_to ?? null,
      stageName: c.contatos?.pipeline_stages?.name ?? null,
      stageColor: c.contatos?.pipeline_stages?.color ?? null,
      archived: !!c.archived,
    })),
    igConversations.map(c => {
      const contato = c.contato_id ? igContatoById.get(c.contato_id) : null
      return {
        id: c.id,
        channel: 'instagram' as const,
        name: c.sender_name || (c.sender_username ? `@${c.sender_username}` : 'Instagram'),
        avatarUrl: c.sender_avatar_url,
        preview: c.last_message_preview,
        lastMessageAt: c.last_message_at,
        unreadCount: c.unread_count,
        assignedTo: contato?.assigned_to ?? null,
        stageName: contato?.pipeline_stages?.name ?? null,
        stageColor: contato?.pipeline_stages?.color ?? null,
        archived: !!c.archived,
      }
    }),
  )

  // Canal selecionado: por ?ch= explícito, senão inferido de qual lista
  // contém o ?id= pedido (deep-link de outra tela sem passar ?ch=).
  let selectedChannel = searchParams.ch === 'instagram' || searchParams.ch === 'whatsapp' ? searchParams.ch : undefined
  if (!selectedChannel && searchParams.id) {
    if (waConversations.some((c: any) => c.id === searchParams.id)) selectedChannel = 'whatsapp'
    else if (igConversations.some(c => c.id === searchParams.id)) selectedChannel = 'instagram'
  }
  if (!selectedChannel && searchParams.lead) selectedChannel = 'whatsapp'

  const sidebar = (
    <UnifiedConversasSidebar
      orgSlug={params.orgSlug}
      rows={unifiedRows}
      selectedId={searchParams.id}
      hasComentarios={planInstagram}
      members={members}
      pipelineStages={(pipelineStages || []).map(s => ({ id: s.id, name: s.name }))}
    />
  )

  if (selectedChannel === 'instagram') {
    const selectedConversation = searchParams.id
      ? igConversations.find(c => c.id === searchParams.id) || null
      : null
    const messages = selectedConversation
      ? await getConversationMessages(params.orgSlug, selectedConversation.id)
      : []
    const emailTemplates = await listEmailTemplates(params.orgSlug)
    const panelContext = selectedConversation
      ? await getSocialConversationContext(params.orgSlug, selectedConversation.id)
      : null

    return (
      <div className="-mx-3 sm:-mx-5 -mb-5 flex-1 min-h-0 flex bg-background overflow-hidden">
        {sidebar}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          <SocialInbox
            orgSlug={params.orgSlug}
            orgId={org.id}
            conversations={igConversations}
            selectedConversation={selectedConversation}
            initialMessages={messages}
            justConnected={searchParams.connected === '1'}
            members={members}
            panelContext={panelContext}
            emailTemplates={emailTemplates}
            orgName={org.name}
            hideSidebar
          />
        </div>
      </div>
    )
  }

  // canal whatsapp (default, inclusive quando nada está selecionado ainda)
  const templates = await getWaTemplates(params.orgSlug)
  const emailTemplates = await listEmailTemplates(params.orgSlug)

  const { data: attendantConfig } = await supabase
    .from('ai_attendant_config')
    .select('is_enabled')
    .eq('organization_id', org.id)
    .maybeSingle()
  const aiEnabledGlobally = attendantConfig?.is_enabled ?? false

  let selectedConversation: any = null
  let messages: any[] = []
  let panelContext: any = null
  let scheduled: any[] = []

  if (searchParams.id) {
    selectedConversation = waConversations.find((c: any) => c.id === searchParams.id) || null
  } else if (searchParams.lead) {
    selectedConversation = waConversations.find((c: any) => c.contato_id === searchParams.lead) || null
  }

  if (selectedConversation) {
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

  return (
    <div className="-mx-3 sm:-mx-5 -mb-5 flex-1 min-h-0 flex bg-background overflow-hidden">
      {sidebar}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <WhatsappChat
          orgSlug={params.orgSlug}
          orgId={org.id}
          conversations={waConversations}
          selectedConversation={selectedConversation}
          initialMessages={messages}
          members={members}
          pipelineStages={(pipelineStages || []).map(s => ({ id: s.id, name: s.name, pipeline_id: s.pipeline_id, position: s.position, is_won: !!s.is_won, is_lost: !!s.is_lost }))}
          panelContext={panelContext}
          scheduled={scheduled}
          templates={templates}
          emailTemplates={emailTemplates}
          orgName={org.name}
          isMock={!org.whatsapp_access_token || org.whatsapp_access_token === 'mock'}
          aiEnabledGlobally={aiEnabledGlobally}
          hideSidebar
        />
      </div>
    </div>
  )
}
