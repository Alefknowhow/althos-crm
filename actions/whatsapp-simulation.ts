'use server'

/**
 * Mock-mode conversation simulator (seed/simulate inbound message) and
 * the conversation-context fetch used when opening a chat.
 * Split out of actions/whatsapp.ts.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization, isSuperAdmin } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'
import { listOrgMembers } from '@/actions/team'

/* ──────────────────────────────────────────────────────────────────────────
 * SIMULADOR (modo mock) — popular/testar a interface de conversas SEM a API
 * da Meta. Normalmente as conversas e as mensagens de entrada chegam pelo
 * webhook; enquanto a API não está plugada, estas ações imitam esse fluxo
 * gravando direto nas tabelas.
 *
 * Guarda: só funciona quando a org está em modo mock (token === 'mock') E o
 * chamador é super-admin OU o ambiente não é produção. Assim não há risco de
 * um cliente real gerar dados falsos na própria caixa de entrada.
 * ──────────────────────────────────────────────────────────────────────── */
async function canSimulate(org: any): Promise<boolean> {
  const isMock = org?.whatsapp_access_token === 'mock'
  if (!isMock) return false
  if (process.env.NODE_ENV !== 'production') return true
  return await isSuperAdmin()
}

/**
 * Cria um punhado de conversas variadas (não lida, conversa longa, mensagem
 * única) para você desenhar a tela com dados realistas. Idempotente o
 * suficiente — sempre adiciona um novo lote.
 */
export async function seedMockConversations(orgSlug: string) {
  const org = await getCurrentOrganization(orgSlug)
  if (!(await canSimulate(org))) {
    return { ok: false, error: 'Simulador disponível apenas em modo mock (WhatsApp não conectado).' }
  }
  const supabase = createClient()
  const now = Date.now()

  // Cada item: dados da conversa + roteiro de mensagens (offset em minutos no passado).
  const scripts: {
    contact_name: string
    contact_phone: string
    unread: number
    msgs: { dir: 'inbound' | 'outbound'; body: string; minsAgo: number }[]
  }[] = [
    {
      contact_name: 'Maria Silva', contact_phone: '5511988887777', unread: 2,
      msgs: [
        { dir: 'inbound',  body: 'Oi! Vi o anúncio de Maceió, ainda tem pacote pra julho?', minsAgo: 9 },
        { dir: 'inbound',  body: 'Seríamos 2 adultos e 1 criança 🙂', minsAgo: 8 },
      ],
    },
    {
      contact_name: 'João Pereira', contact_phone: '5521977776666', unread: 0,
      msgs: [
        { dir: 'inbound',  body: 'Bom dia, queria um orçamento pra Buenos Aires', minsAgo: 180 },
        { dir: 'outbound', body: 'Bom dia, João! Claro. Para quais datas?', minsAgo: 176 },
        { dir: 'inbound',  body: 'Primeira quinzena de agosto', minsAgo: 170 },
        { dir: 'outbound', body: 'Perfeito, vou montar duas opções e te envio ainda hoje 👍', minsAgo: 168 },
      ],
    },
    {
      contact_name: 'Ana Costa', contact_phone: '5531966665555', unread: 1,
      msgs: [
        { dir: 'inbound',  body: 'Vocês parcelam em quantas vezes?', minsAgo: 35 },
      ],
    },
  ]

  let created = 0
  for (const s of scripts) {
    const lastMins = Math.min(...s.msgs.map(m => m.minsAgo))
    const lastMsg = s.msgs.find(m => m.minsAgo === lastMins) ?? s.msgs[s.msgs.length - 1]
    const { data: conv, error: convErr } = await supabase
      .from('whatsapp_conversations')
      .insert({
        organization_id:        org.id,
        contact_phone:          s.contact_phone,
        contact_name:           s.contact_name,
        last_message_at:        new Date(now - lastMins * 60_000).toISOString(),
        last_message_preview:   lastMsg.body,
        last_message_direction: lastMsg.dir,
        unread_count:           s.unread,
        status:                 'open',
      })
      .select('id')
      .single()
    if (convErr || !conv) continue

    const rows = s.msgs.map(m => ({
      conversation_id: conv.id,
      organization_id: org.id,
      direction:       m.dir,
      type:            'text',
      content:         { body: m.body },
      status:          m.dir === 'outbound' ? 'read' : 'received',
      created_at:      new Date(now - m.minsAgo * 60_000).toISOString(),
    }))
    await supabase.from('whatsapp_messages').insert(rows)
    created++
  }

  revalidatePath(`/app/${orgSlug}/conversas`)
  return { ok: true, created }
}

/**
 * Imita o webhook: insere uma mensagem de ENTRADA na conversa, incrementa o
 * contador de não lidas e atualiza o horário da última mensagem. O realtime
 * da tela já mostra a mensagem aparecer ao vivo.
 */
export async function simulateInboundMessage(orgSlug: string, conversationId: string, text: string) {
  const org = await getCurrentOrganization(orgSlug)
  if (!(await canSimulate(org))) {
    return { ok: false, error: 'Simulador disponível apenas em modo mock (WhatsApp não conectado).' }
  }
  const body = (text || '').trim()
  if (!body) return { ok: false, error: 'Mensagem vazia.' }

  const supabase = createClient()
  const { data: conv } = await supabase
    .from('whatsapp_conversations')
    .select('id, unread_count')
    .eq('id', conversationId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!conv) return { ok: false, error: 'Conversa não encontrada.' }

  const { error: msgErr } = await supabase.from('whatsapp_messages').insert({
    conversation_id: conv.id,
    organization_id: org.id,
    direction:       'inbound',
    type:            'text',
    content:         { body },
    status:          'received',
    meta_message_id: `wamid.SIMULATED_${Date.now()}`,
  })
  if (msgErr) return { ok: false, error: msgErr.message }

  await supabase
    .from('whatsapp_conversations')
    .update({
      unread_count:           (conv.unread_count ?? 0) + 1,
      last_message_at:        new Date().toISOString(),
      last_message_preview:   body,
      last_message_direction: 'inbound',
    })
    .eq('id', conv.id)

  revalidatePath(`/app/${orgSlug}/conversas`)
  return { ok: true }
}

/* ──────────────────────────────────────────────────────────────────────────
 * PAINEL LATERAL DO LEAD + RESPONSÁVEL DO ATENDIMENTO
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Carrega o contexto que o painel lateral precisa para uma conversa: o lead
 * vinculado (se houver), os estágios do pipeline padrão (para mover) e os
 * membros da org (para os seletores de responsável). Centraliza num único
 * round-trip chamado quando a conversa é selecionada.
 */
export async function getConversationContext(orgSlug: string, conversationId: string) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data: conversation } = await supabase
    .from('whatsapp_conversations')
    .select('*')
    .eq('id', conversationId)
    .eq('organization_id', org.id)
    .maybeSingle()

  let lead: any = null
  if (conversation?.contato_id) {
    const { data } = await supabase
      .from('contatos')
      .select('*, pipeline_stages(id, name)')
      .eq('id', conversation.contato_id)
      .eq('organization_id', org.id)
      .maybeSingle()
    lead = data
  }

  // Estágios do pipeline padrão da org (para o seletor "mover de etapa").
  const { data: pipeline } = await supabase
    .from('pipelines')
    .select('id')
    .eq('organization_id', org.id)
    .eq('is_default', true)
    .maybeSingle()

  let stages: { id: string; name: string; is_won: boolean; is_lost: boolean }[] = []
  if (pipeline) {
    const { data: st } = await supabase
      .from('pipeline_stages')
      .select('id, name, position, is_won, is_lost')
      .eq('pipeline_id', pipeline.id)
      .order('position', { ascending: true })
    stages = (st ?? []).map(s => ({ id: s.id, name: s.name, is_won: !!s.is_won, is_lost: !!s.is_lost }))
  }

  const members = await listOrgMembers(orgSlug)

  return { conversation, lead, stages, members, defaultPipelineId: pipeline?.id ?? null }
}

