/**
 * Envio da pesquisa NPS (0-10) via WhatsApp — núcleo compartilhado entre o
 * disparo manual (actions/contatos-customers.ts::triggerNpsSurvey, roda com
 * sessão de usuário) e o step de automação "Enviar pesquisa NPS"
 * (lib/inngest/automation.ts, roda em background com o client admin).
 * Por isso recebe o client Supabase já pronto (RLS ou admin) em vez de criar
 * o seu — não faz `requireAuth()`, quem chama decide o contexto de auth.
 *
 * A captura automática da resposta do cliente (ler o número que ele manda de
 * volta) ainda não está implementada — o pipeline de ingestão do WhatsApp
 * está em refatoração. Por enquanto a nota é registrada manualmente
 * (ver setNpsScore em actions/contatos-customers.ts).
 */

import { sendTextMessage } from '@/lib/whatsapp/meta-client'

export type NpsSendResult = { ok: true } | { ok: false; error: string }

export async function sendNpsSurveyCore(
  supabase: any,
  orgConfig: { id: string; whatsapp_phone_number_id?: string | null; whatsapp_access_token?: string | null },
  lead: { id: string; name: string; phone: string | null },
): Promise<NpsSendResult> {
  if (!lead.phone) return { ok: false, error: 'Esse contato não tem telefone cadastrado.' }
  const orgId = orgConfig.id
  const phone = lead.phone.replace(/\D/g, '')
  const firstName = (lead.name || '').trim().split(/\s+/)[0] || ''

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

  const body = `Oi${firstName ? `, ${firstName}` : ''}! De 0 a 10, o quanto você recomendaria a gente para um amigo ou familiar? Responda só com o número 🙂`

  const { data: msg, error: insertError } = await supabase
    .from('whatsapp_messages')
    .insert({
      conversation_id: conversationId,
      organization_id: orgId,
      direction: 'outbound',
      type: 'text',
      content: { body },
      status: 'sending',
      sent_by_name: 'Pesquisa NPS',
    })
    .select()
    .single()
  if (insertError || !msg) return { ok: false, error: insertError?.message || 'Erro ao registrar a mensagem.' }

  try {
    const metaRes = await sendTextMessage(orgConfig, phone, body)
    await supabase.from('whatsapp_messages').update({ meta_message_id: metaRes.messages[0].id, status: 'sent' }).eq('id', msg.id)
    await supabase.from('whatsapp_conversations').update({
      last_message_at: new Date().toISOString(),
      last_message_preview: body,
      last_message_direction: 'outbound',
      last_message_status: 'sent',
    }).eq('id', conversationId)
  } catch (e: any) {
    await supabase.from('whatsapp_messages').update({ status: 'failed' }).eq('id', msg.id)
    return { ok: false, error: e?.message || 'Erro ao enviar pelo WhatsApp.' }
  }

  await supabase.from('contatos').update({
    nps_status: 'aguardando',
    nps_sent_at: new Date().toISOString(),
  }).eq('id', lead.id)

  await supabase.from('contato_activities').insert({
    contato_id: lead.id,
    organization_id: orgId,
    type: 'nps_sent',
    payload: { body },
  })

  return { ok: true }
}
