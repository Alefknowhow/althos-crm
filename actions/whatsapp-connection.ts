'use server'

/**
 * WhatsApp connection lifecycle: create/find a conversation for a lead,
 * disconnect, embedded-signup OAuth connect, connection test.
 * Split out of actions/whatsapp.ts.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization, isImpersonating } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'
import { checkFeatureAccessByOrgSlug } from '@/lib/plans/server'

const WHATSAPP_UPGRADE_ERROR = 'WhatsApp não está incluído no seu plano atual. Faça upgrade para o Pro ou Business para usar este recurso.'

/** Botão "Iniciar Waba" no card do lead: acha a conversa já existente com
 * esse contato ou cria uma nova (sem enviar mensagem nenhuma) usando o
 * telefone salvo no lead, pra abrir o chat já pronto pra digitar. */
export async function getOrCreateConversationForLead(orgSlug: string, contatoId: string) {
  if (!(await checkFeatureAccessByOrgSlug(orgSlug, 'whatsapp'))) {
    return { ok: false as const, error: WHATSAPP_UPGRADE_ERROR }
  }
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data: existing } = await supabase
    .from('whatsapp_conversations')
    .select('id')
    .eq('organization_id', org.id)
    .eq('contato_id', contatoId)
    .maybeSingle()
  if (existing) return { ok: true as const, conversationId: existing.id }

  const { data: contato } = await supabase
    .from('contatos')
    .select('id, name, phone')
    .eq('id', contatoId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!contato?.phone) return { ok: false as const, error: 'Esse lead não tem telefone cadastrado.' }

  const { data: created, error } = await supabase
    .from('whatsapp_conversations')
    .insert({
      organization_id: org.id,
      contato_id: contato.id,
      contact_phone: contato.phone.replace(/\D/g, ''),
      contact_name: contato.name,
    })
    .select('id')
    .single()
  if (error || !created) return { ok: false as const, error: error?.message || 'Não foi possível iniciar a conversa.' }

  return { ok: true as const, conversationId: created.id }
}

export async function disconnectWhatsapp(orgSlug: string) {
  if (isImpersonating()) {
    return { ok: false, error: 'Desconectar WhatsApp não é permitido em modo de impersonação.' }
  }
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { error } = await supabase
    .from('organizations')
    .update({ whatsapp_phone_number_id: null, whatsapp_waba_id: null, whatsapp_access_token: null, whatsapp_display_phone: null })
    .eq('id', org.id)

  if (error) return { ok: false, error: error.message }

  // O histórico pertence ao número desconectado — limpa junto pra não deixar
  // conversas de um número antigo misturadas com as do próximo que conectar
  // (mensagens/agendamentos somem em cascata pela FK de whatsapp_conversations).
  const { error: convError } = await supabase
    .from('whatsapp_conversations')
    .delete()
    .eq('organization_id', org.id)
  if (convError) console.error('disconnectWhatsapp: falha ao limpar histórico de conversas', convError)

  revalidatePath(`/app/${orgSlug}/configuracoes/whatsapp`)
  revalidatePath(`/app/${orgSlug}/conversas`)
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
  if (!(await checkFeatureAccessByOrgSlug(orgSlug, 'whatsapp'))) {
    return { ok: false, error: WHATSAPP_UPGRADE_ERROR }
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
  const GRAPH = 'https://graph.facebook.com/v26.0'

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

    // 3. Busca o número/nome exibido — é o que a tela mostra no lugar do
    // phone_number_id técnico, pra dar pra reconhecer qual conta está ativa.
    let displayPhone: string | null = null
    let verifiedName: string | null = null
    try {
      const phoneRes = await fetch(
        `${GRAPH}/${params.phoneNumberId}?fields=display_phone_number,verified_name`,
        { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10_000) },
      )
      const phoneData = await phoneRes.json()
      if (phoneRes.ok) {
        displayPhone = phoneData?.display_phone_number ?? null
        verifiedName = phoneData?.verified_name ?? null
      }
    } catch { /* informativo, não bloqueia */ }

    // 4. Persiste as credenciais na org (mesmo modelo do fluxo manual).
    const supabase = createClient()
    const { error } = await supabase
      .from('organizations')
      .update({
        whatsapp_phone_number_id: params.phoneNumberId,
        whatsapp_waba_id: params.wabaId,
        whatsapp_access_token: accessToken,
        whatsapp_display_phone: displayPhone && verifiedName ? `${verifiedName} — ${displayPhone}` : displayPhone,
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
    const res = await fetch(`https://graph.facebook.com/v26.0/${org.whatsapp_phone_number_id}`, {
      headers: { 'Authorization': `Bearer ${org.whatsapp_access_token}` }
    })
    const data = await res.json()
    if (data.error) throw new Error(data.error.message)
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

