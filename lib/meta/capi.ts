/**
 * Meta Conversions API (CAPI) helper.
 * Fires events server-to-server so they bypass ad-blockers and iOS tracking restrictions.
 *
 * Docs: https://developers.facebook.com/docs/marketing-api/conversions-api
 */

import { createHash } from 'crypto'
import { normalizePhoneE164BR } from '@/lib/phone'

// SHA-256 hash a normalised string (Meta requires lowercase + trimmed for PII)
function hashField(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
}

export type CapiEventPayload = {
  pixelId: string
  accessToken: string
  eventName: string   // 'Lead' | 'Purchase' | 'CompleteRegistration' | custom
  eventTime?: number  // unix seconds, defaults to now
  eventSourceUrl?: string
  userAgent?: string
  clientIpAddress?: string
  email?: string | null
  phone?: string | null
  firstName?: string | null
  // Deduplicate with client-side fbq: pass the same event_id used in fbq()
  eventId?: string
  // Custom data
  currency?: string
  value?: number
  orderId?: string
  // Attribution: click IDs, sem eles a Meta geralmente não consegue linkar
  // o evento a um anúncio/campanha específico pra otimizar a entrega.
  fbc?: string | null           // cookie _fbc (clique em anúncio no site)
  fbp?: string | null           // cookie _fbp (browser id do Pixel)
  ctwaClid?: string | null      // Click-to-WhatsApp Click ID (referral do webhook)
  actionSource?: 'website' | 'business_messaging'
}

export type CapiEventResult = { ok: boolean; httpStatus?: number; error?: string }

export async function sendCapiEvent(payload: CapiEventPayload): Promise<CapiEventResult> {
  const {
    pixelId, accessToken, eventName,
    eventTime = Math.floor(Date.now() / 1000),
    email, phone, firstName,
    eventSourceUrl, userAgent, clientIpAddress,
    eventId, currency, value, orderId,
    fbc, fbp, ctwaClid, actionSource = 'website',
  } = payload

  const userData: Record<string, string> = {}
  const hashedEmail = hashField(email)
  const hashedPhone = hashField(normalizePhoneE164BR(phone))
  const hashedFn = hashField(firstName)
  if (hashedEmail) userData.em = hashedEmail
  if (hashedPhone) userData.ph = hashedPhone
  if (hashedFn)    userData.fn = hashedFn
  if (clientIpAddress) userData.client_ip_address = clientIpAddress
  if (userAgent)   userData.client_user_agent = userAgent
  // fbc/fbp vão sem hash — são identificadores de clique, não PII.
  if (fbc) userData.fbc = fbc
  if (fbp) userData.fbp = fbp

  const customData: Record<string, any> = {}
  if (currency) customData.currency = currency
  if (value)    customData.value    = value
  if (orderId)  customData.order_id = orderId
  if (ctwaClid) customData.ctwa_clid = ctwaClid

  const event: Record<string, any> = {
    event_name:   eventName,
    event_time:   eventTime,
    action_source: actionSource,
    user_data:    userData,
  }
  if (eventSourceUrl) event.event_source_url = eventSourceUrl
  if (eventId)        event.event_id          = eventId
  if (Object.keys(customData).length) event.custom_data = customData

  const url = `https://graph.facebook.com/v26.0/${pixelId}/events?access_token=${accessToken}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: [event] }),
    // Don't wait more than 5s — failure is non-blocking
    signal: AbortSignal.timeout(5000),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '(unreadable)')
    return { ok: false, httpStatus: res.status, error: body.slice(0, 300) }
  }
  return { ok: true, httpStatus: res.status }
}

/** Wrapper de `sendCapiEvent` que grava o resultado em `capi_event_log`
 *  (issue #27/#61, passo 2.3) — best-effort, nunca lança: se o log falhar,
 *  o envio do evento já aconteceu e não deve ser bloqueado por isso. Não
 *  muda payload/eventos disparados, só adiciona observabilidade. */
export async function sendCapiEventLogged(
  payload: CapiEventPayload,
  ctx: {
    supabase: { from: (table: string) => any }
    organizationId: string
    pipelineId?: string | null
    contatoId?: string | null
    source: 'form' | 'pipeline' | 'qualification' | 'portal_conversion'
  },
): Promise<CapiEventResult> {
  let result: CapiEventResult
  try {
    result = await sendCapiEvent(payload)
  } catch (e: any) {
    result = { ok: false, error: e?.message || 'Erro desconhecido' }
  }

  try {
    await ctx.supabase.from('capi_event_log').insert({
      organization_id: ctx.organizationId,
      pipeline_id: ctx.pipelineId || null,
      contato_id: ctx.contatoId || null,
      event_name: payload.eventName,
      event_id: payload.eventId || null,
      status: result.ok ? 'sent' : 'failed',
      http_status: result.httpStatus ?? null,
      error: result.error ?? null,
      source: ctx.source,
    })
  } catch { /* best-effort — log nunca bloqueia o envio */ }

  return result
}
