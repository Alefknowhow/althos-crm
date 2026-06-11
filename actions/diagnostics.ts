'use server'

/**
 * Self-service diagnostics for the two channels that depend on external config
 * (Resend e-mail + Web Push). Each "test" sends ONLY to the logged-in user and
 * returns the real provider response — including the error message — instead of
 * swallowing it. This makes silent misconfigurations (unverified domain, missing
 * VAPID key, no subscription) visible from the Notificações settings page.
 */

import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { createAdminClient } from '@/lib/supabase/server'
import { getResend, EMAIL_FROM } from '@/lib/resend'
import { sendPushToUser } from '@/actions/push'

// ── E-mail ──────────────────────────────────────────────────────────────────

export type EmailDiag = {
  ok: boolean
  to?: string
  from: string
  apiKeySet: boolean
  /** Resend verified-domain status (best-effort; null if the API call failed). */
  domains: { name: string; status: string }[] | null
  messageId?: string
  error?: string
}

/**
 * Checks Resend config and sends a test e-mail to the current user. Returns the
 * verified-domain list so an unverified sender domain (the usual cause of
 * "e-mails never arrive") is obvious.
 */
export async function sendTestEmail(orgSlug: string): Promise<EmailDiag> {
  const user = await requireAuth()
  await getCurrentOrganization(orgSlug) // ensures membership / 404 otherwise

  const apiKeySet = !!process.env.RESEND_API_KEY
  const from = EMAIL_FROM
  const to = user.email || undefined

  // Best-effort: list verified domains so we can show their status.
  let domains: EmailDiag['domains'] = null
  if (apiKeySet) {
    try {
      const res = await fetch('https://api.resend.com/domains', {
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        cache: 'no-store',
      })
      if (res.ok) {
        const json: any = await res.json()
        const list = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : []
        domains = list.map((d: any) => ({ name: d.name, status: d.status }))
      }
    } catch {
      domains = null
    }
  }

  if (!apiKeySet) {
    return { ok: false, from, to, apiKeySet, domains, error: 'RESEND_API_KEY não está configurada no ambiente.' }
  }
  if (!to) {
    return { ok: false, from, to, apiKeySet, domains, error: 'Seu usuário não tem e-mail cadastrado.' }
  }

  try {
    const { data, error } = await getResend().emails.send({
      from,
      to,
      subject: 'Teste de e-mail — Althos CRM',
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
          <h1 style="font-size:20px;font-weight:800;margin-bottom:8px">Althos CRM</h1>
          <p>Este é um e-mail de teste enviado pela página de Notificações.</p>
          <p style="color:#6b7280;font-size:13px">Se você recebeu esta mensagem, o envio transacional (Resend) está funcionando.</p>
        </div>
      `,
    })
    if (error) {
      return { ok: false, from, to, apiKeySet, domains, error: error.message || String(error) }
    }
    return { ok: true, from, to, apiKeySet, domains, messageId: data?.id }
  } catch (e: any) {
    return { ok: false, from, to, apiKeySet, domains, error: e?.message || 'Falha ao enviar e-mail.' }
  }
}

// ── Push ──────────────────────────────────────────────────────────────────────

export type PushDiag = {
  ok: boolean
  vapidSet: boolean
  subscriptions: number
  sent: number
  failed: number
  error?: string
}

/**
 * Sends a test push notification to the current user's subscribed devices and
 * reports how many were reached. Surfaces "no subscription on this device" and
 * "VAPID not configured" as distinct, actionable messages.
 */
export async function sendTestPush(orgSlug: string): Promise<PushDiag> {
  const user = await requireAuth()
  await getCurrentOrganization(orgSlug) // ensures membership / 404 otherwise

  const vapidSet =
    !!(process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) &&
    !!process.env.VAPID_PRIVATE_KEY

  // Count this user's subscriptions (any device, any org of the account).
  let subscriptions = 0
  try {
    const admin = createAdminClient()
    const { count } = await admin
      .from('push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
    subscriptions = count ?? 0
  } catch {
    subscriptions = 0
  }

  if (!vapidSet) {
    return { ok: false, vapidSet, subscriptions, sent: 0, failed: 0, error: 'Chaves VAPID não configuradas no ambiente.' }
  }
  if (subscriptions === 0) {
    return {
      ok: false,
      vapidSet,
      subscriptions,
      sent: 0,
      failed: 0,
      error: 'Nenhum dispositivo inscrito. Clique no sino para ativar o push neste navegador e tente novamente.',
    }
  }

  try {
    const { sent, failed } = await sendPushToUser(user.id, {
      title: 'Teste de notificação 🔔',
      body: 'Se você está vendo isto, o push está funcionando!',
      url: `/app/${orgSlug}/configuracoes/notificacoes`,
      tag: 'althos-test',
    })
    return { ok: sent > 0, vapidSet, subscriptions, sent, failed }
  } catch (e: any) {
    return { ok: false, vapidSet, subscriptions, sent: 0, failed: 0, error: e?.message || 'Falha ao enviar push.' }
  }
}
