/**
 * Envio da pesquisa NPS (0-10) via WhatsApp — núcleo compartilhado entre o
 * disparo manual (actions/contatos-customers.ts::triggerNpsSurvey, roda com
 * sessão de usuário) e o step de automação "Pesquisa NPS"
 * (lib/inngest/automation-step-executor.ts, roda em background com o
 * client admin). Por isso recebe o client Supabase já pronto (RLS ou
 * admin) em vez de criar o seu — não faz `requireAuth()`, quem chama
 * decide o contexto de auth.
 *
 * Sempre manda um template aprovado (nunca texto livre): a Meta rejeita
 * mensagem de texto livre fora da janela de 24h de sessão, que é
 * exatamente o caso comum de pesquisa pós-venda/pós-viagem (dias depois).
 *
 * A nota do cliente é sempre registrada manualmente (setNpsScore, em
 * actions/contatos-customers.ts) — ler a resposta automaticamente é uma
 * automação separada, ainda não construída.
 */

import { sendTemplateMessage } from '@/lib/whatsapp/meta-client'

export type NpsSendResult = { ok: true } | { ok: false; error: string }

export type NpsTemplate = {
  name: string
  variables: string[]
  language?: string
}

export async function sendNpsSurveyCore(
  supabase: any,
  orgConfig: { id: string; whatsapp_phone_number_id?: string | null; whatsapp_access_token?: string | null },
  lead: { id: string; name: string; phone: string | null },
  template: NpsTemplate,
): Promise<NpsSendResult> {
  if (!lead.phone) return { ok: false, error: 'Esse contato não tem telefone cadastrado.' }
  if (!template.name) return { ok: false, error: 'Selecione um template de WhatsApp aprovado.' }
  const orgId = orgConfig.id
  const phone = lead.phone.replace(/\D/g, '')

  // Confere que o template existe e está aprovado na Meta — evita mandar
  // (e falhar do lado de lá) um template ainda pendente/rejeitado/local.
  const { data: tpl } = await supabase
    .from('whatsapp_templates')
    .select('status, body_text')
    .eq('organization_id', orgId)
    .eq('name', template.name)
    .maybeSingle()
  if (!tpl) return { ok: false, error: 'Template não encontrado.' }
  if (tpl.status !== 'approved') return { ok: false, error: 'Esse template ainda não foi aprovado pela Meta.' }

  let conversationId: string
  const { data: existingConv } = await supabase
    .from('whatsapp_conversations')
    .select('id')
    .eq('organization_id', orgId)
    .eq('contato_id', lead.id)
    .maybeSingle()

  if (existingConv) {
    conversationId = existingConv.id
  } else {
    const { data: created, error } = await supabase
      .from('whatsapp_conversations')
      .insert({ organization_id: orgId, contato_id: lead.id, contact_phone: phone, contact_name: lead.name })
      .select('id')
      .single()
    if (error || !created) return { ok: false, error: error?.message || 'Não foi possível abrir a conversa.' }
    conversationId = created.id
  }

  // Prévia legível pro inbox — o corpo real (com variáveis substituídas
  // pela própria Meta) só se sabe depois do envio; isso aqui é só pra lista.
  const preview = tpl.body_text || `Pesquisa NPS (${template.name})`

  const { data: msg, error: insertError } = await supabase
    .from('whatsapp_messages')
    .insert({
      conversation_id: conversationId,
      organization_id: orgId,
      direction: 'outbound',
      type: 'text',
      content: { body: preview },
      status: 'sending',
      sent_by_name: 'Pesquisa NPS',
    })
    .select()
    .single()
  if (insertError || !msg) return { ok: false, error: insertError?.message || 'Erro ao registrar a mensagem.' }

  try {
    const metaRes = await sendTemplateMessage(orgConfig, phone, template.name, template.variables, template.language || 'pt_BR')
    await supabase.from('whatsapp_messages').update({ meta_message_id: metaRes.messages[0].id, status: 'sent' }).eq('id', msg.id)
    await supabase.from('whatsapp_conversations').update({
      last_message_at: new Date().toISOString(),
      last_message_preview: preview,
      last_message_direction: 'outbound',
      last_message_status: 'sent',
    }).eq('id', conversationId)
  } catch (e: any) {
    await supabase.from('whatsapp_messages').update({ status: 'failed' }).eq('id', msg.id)
    return { ok: false, error: e?.message || 'Erro ao enviar pelo WhatsApp.' }
  }

  await supabase.from('contato_activities').insert({
    contato_id: lead.id,
    organization_id: orgId,
    type: 'nps_sent',
    payload: { template: template.name },
  })

  return { ok: true }
}
