/**
 * Shared WhatsApp types for the provider abstraction.
 *
 * The whole app talks to WhatsApp through ONE interface (WhatsAppProvider),
 * so Conversas / Automações / Atendente IA never branch on "official vs QR".
 * Two concrete providers implement it: Meta Cloud API and the QR gateway.
 */

export type WhatsAppProviderKind = 'cloud_api' | 'qr'

export type WhatsAppConnectionStatus =
  | 'disconnected'
  | 'pending'
  | 'connected'
  | 'error'

/** A row from public.whatsapp_connections (only the fields callers need). */
export interface WhatsAppConnection {
  id: string
  organization_id: string
  provider: WhatsAppProviderKind
  status: WhatsAppConnectionStatus
  is_enabled: boolean
  display_name: string | null
  phone_number: string | null
  // cloud_api
  phone_number_id: string | null
  access_token: string | null
  // qr / gateway
  gateway_instance: string | null
  qr_code: string | null
  last_connected_at: string | null
  last_error: string | null
}

/** Uniform result of any outbound send, regardless of provider. */
export interface SendResult {
  ok: boolean
  /** Provider-side message id (Meta wamid, or gateway id). */
  messageId?: string
  error?: string
}

export interface SendTemplateArgs {
  to: string
  templateName: string
  variables: string[]
  languageCode?: string
  headerType?: 'image' | 'video' | 'document' | string
  headerMediaUrl?: string
}

/**
 * The single contract the rest of the system depends on.
 * `supportsTemplates` lets automations decide between a template send
 * (Cloud API) and a plain-text fallback (QR).
 */
export interface WhatsAppProvider {
  readonly kind: WhatsAppProviderKind
  readonly supportsTemplates: boolean
  sendText(to: string, text: string): Promise<SendResult>
  sendTemplate(args: SendTemplateArgs): Promise<SendResult>
}
