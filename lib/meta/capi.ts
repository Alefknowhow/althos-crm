/**
 * Meta Conversions API (CAPI) helper.
 * Fires events server-to-server so they bypass ad-blockers and iOS tracking restrictions.
 *
 * Docs: https://developers.facebook.com/docs/marketing-api/conversions-api
 */

import { createHash } from 'crypto'

// SHA-256 hash a normalised string (Meta requires lowercase + trimmed for PII)
function hashField(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
}

// Normalise phone: keep only digits, ensure country code prefix if BRN
function normalisePhone(phone: string | null | undefined): string | undefined {
  if (!phone) return undefined
  const digits = phone.replace(/\D/g, '')
  // Brazil: if 10-11 digits without country code, prefix with 55
  if (digits.length <= 11) return `55${digits}`
  return digits
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
}

export async function sendCapiEvent(payload: CapiEventPayload): Promise<void> {
  const {
    pixelId, accessToken, eventName,
    eventTime = Math.floor(Date.now() / 1000),
    email, phone, firstName,
    eventSourceUrl, userAgent, clientIpAddress,
    eventId, currency, value, orderId,
  } = payload

  const userData: Record<string, string> = {}
  const hashedEmail = hashField(email)
  const hashedPhone = hashField(normalisePhone(phone))
  const hashedFn = hashField(firstName)
  if (hashedEmail) userData.em = hashedEmail
  if (hashedPhone) userData.ph = hashedPhone
  if (hashedFn)    userData.fn = hashedFn
  if (clientIpAddress) userData.client_ip_address = clientIpAddress
  if (userAgent)   userData.client_user_agent = userAgent

  const customData: Record<string, any> = {}
  if (currency) customData.currency = currency
  if (value)    customData.value    = value
  if (orderId)  customData.order_id = orderId

  const event: Record<string, any> = {
    event_name:   eventName,
    event_time:   eventTime,
    action_source: 'website',
    user_data:    userData,
  }
  if (eventSourceUrl) event.event_source_url = eventSourceUrl
  if (eventId)        event.event_id          = eventId
  if (Object.keys(customData).length) event.custom_data = customData

  const url = `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${accessToken}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: [event] }),
    // Don't wait more than 5s — failure is non-blocking
    signal: AbortSignal.timeout(5000),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '(unreadable)')
    throw new Error(`Meta CAPI ${res.status}: ${body.slice(0, 300)}`)
  }
}
