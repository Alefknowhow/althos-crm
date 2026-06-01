'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization, isImpersonating } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'
import { sendTextMessage } from '@/lib/whatsapp/meta-client'

export async function saveWhatsappConfig(orgSlug: string, phone_id: string, token: string) {
  if (isImpersonating()) {
    return { ok: false, error: 'Alteração de credenciais críticas não permitida em modo de impersonação.' }
  }
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  
  const { error } = await supabase.from('organizations').update({
    whatsapp_phone_number_id: phone_id,
    whatsapp_access_token: token
  }).eq('id', org.id)
  
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/app/${orgSlug}/configuracoes/whatsapp`)
  return { ok: true }
}

/**
 * Embedded Signup (Meta) — conecta o WhatsApp do cliente sem ele copiar
 * Phone Number ID / token na mão.
 *
 * O popup do Facebook devolve um `code` de autorização + (via postMessage) o
 * `phone_number_id` e o `waba_id`. Aqui trocamos o code por um access token
 * usando as credenciais do App da Althos, assinamos o app no webhook da WABA
 * (some o passo manual de webhook) e salvamos as credenciais na org.
 *
 * Requer (lado Althos, uma vez): META_APP_ID + META_APP_SECRET de um App com
 * o produto WhatsApp + Embedded Signup aprovado. Sem isso, retorna erro claro
 * e a tela cai no formulário manual.
 */
export async function connectWhatsappEmbedded(
  orgSlug: string,
  params: { code: string; phoneNumberId: string; wabaId: string },
) {
  if (isImpersonating()) {
    return { ok: false, error: 'Conexão de WhatsApp não permitida em modo de impersonação.' }
  }

  const appId = process.env.META_APP_ID
  const appSecret = process.env.META_APP_SECRET
  if (!appId || !appSecret) {
    return { ok: false, error: 'Embedded Signup não está configurado neste ambiente.' }
  }
  if (!params.code || !params.phoneNumberId || !params.wabaId) {
    return { ok: false, error: 'Dados incompletos retornados pela Meta. Tente novamente.' }
  }

  const org = await getCurrentOrganization(orgSlug)
  const GRAPH = 'https://graph.facebook.com/v19.0'

  try {
    // 1. Troca o código de autorização por um access token do negócio do cliente.
    const tokenRes = await fetch(
      `${GRAPH}/oauth/access_token?client_id=${appId}` +
        `&client_secret=${appSecret}&code=${encodeURIComponent(params.code)}`,
      { signal: AbortSignal.timeout(15_000) },
    )
    const tokenData = await tokenRes.json()
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(tokenData?.error?.message || 'Falha ao obter token de acesso.')
    }
    const accessToken: string = tokenData.access_token

    // 2. Assina o App da Althos nos webhooks da WABA do cliente (recebe msgs).
    const subRes = await fetch(`${GRAPH}/${params.wabaId}/subscribed_apps`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15_000),
    })
    if (!subRes.ok) {
      const subErr = await subRes.json().catch(() => ({}))
      throw new Error(subErr?.error?.message || 'Falha ao assinar o webhook da conta.')
    }

    // 3. Busca o número exibido para guardar junto (informativo).
    let displayPhone: string | null = null
    try {
      const phoneRes = await fetch(
        `${GRAPH}/${params.phoneNumberId}?fields=display_phone_number,verified_name`,
        { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10_000) },
      )
      const phoneData = await phoneRes.json()
      if (phoneRes.ok) displayPhone = phoneData?.display_phone_number ?? null
    } catch { /* informativo, não bloqueia */ }

    // 4. Persiste as credenciais na org (mesmo modelo do fluxo manual).
    const supabase = createClient()
    const { error } = await supabase
      .from('organizations')
      .update({
        whatsapp_phone_number_id: params.phoneNumberId,
        whatsapp_access_token: accessToken,
      })
      .eq('id', org.id)
    if (error) throw new Error(error.message)

    revalidatePath(`/app/${orgSlug}/configuracoes/whatsapp`)
    return { ok: true, displayPhone }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Erro ao conectar o WhatsApp.' }
  }
}

export async function testWhatsappConnection(orgSlug: string) {
  const org = await getCurrentOrganization(orgSlug)
  if (!org.whatsapp_phone_number_id || !org.whatsapp_access_token) return { ok: false, error: 'Credenciais não configuradas' }
  if (org.whatsapp_access_token === 'mock') return { ok: true }

  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${org.whatsapp_phone_number_id}`, {
      headers: { 'Authorization': `Bearer ${org.whatsapp_access_token}` }
    })
    const data = await res.json()
    if (data.error) throw new Error(data.error.message)
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

export async function sendWhatsappMessage(orgSlug: string, conversationId: string, content: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data: conv } = await supabase.from('whatsapp_conversations').select('*').eq('id', conversationId).eq('organization_id', org.id).maybeSingle()
  if (!conv) return { ok: false, error: 'Conversa não encontrada' }

  const { data: msg, error: insertError } = await supabase.from('whatsapp_messages').insert({
    conversation_id: conv.id,
    organization_id: org.id,
    direction: 'outbound',
    type: 'text',
    content: { body: content },
    status: 'sending'
  }).select().single()

  if (insertError) return { ok: false, error: insertError.message }

  try {
    const metaRes = await sendTextMessage(org, conv.contact_phone, content)
    
    await supabase.from('whatsapp_messages').update({
      meta_message_id: metaRes.messages[0].id,
      status: 'sent'
    }).eq('id', msg.id)
    
    if (conv.lead_id) {
       await supabase.from('lead_activities').insert({
          lead_id: conv.lead_id,
          organization_id: org.id,
          type: 'whatsapp_sent',
          payload: { body: content }
       })
    }

    revalidatePath(`/app/${orgSlug}/conversas`)
    return { ok: true, message: msg }
  } catch (e: any) {
    await supabase.from('whatsapp_messages').update({
      status: 'failed',
      content: { body: content, error: e.message }
    }).eq('id', msg.id)
    return { ok: false, error: e.message }
  }
}

export async function markConversationAsRead(orgSlug: string, conversationId: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  await supabase.from('whatsapp_conversations').update({ unread_count: 0 }).eq('id', conversationId).eq('organization_id', org.id)
  revalidatePath(`/app/${orgSlug}/conversas`)
}
