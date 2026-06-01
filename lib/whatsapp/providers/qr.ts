import type {
  WhatsAppProvider, WhatsAppConnection, SendResult, SendTemplateArgs,
} from '../types'

/**
 * Unofficial QR-session provider (WhatsApp Web via a self-hosted gateway).
 *
 * The gateway (e.g. a self-hosted Evolution API / Baileys worker) holds the
 * persistent socket — it CANNOT run inside Next.js/Vercel. This class only
 * speaks REST to that worker:
 *
 *   POST {GATEWAY_URL}/instances/{instance}/send-text  { to, text }
 *
 * Config comes from env so we stay gateway-agnostic for now:
 *   WHATSAPP_QR_GATEWAY_URL    base URL of the worker
 *   WHATSAPP_QR_GATEWAY_TOKEN  bearer/api key (optional)
 *
 * Templates are NOT supported on QR — sendTemplate degrades to plain text
 * so automations keep working with a graceful fallback.
 */
export class QrProvider implements WhatsAppProvider {
  readonly kind = 'qr' as const
  readonly supportsTemplates = false

  constructor(private readonly conn: WhatsAppConnection) {}

  private get base(): string | null {
    return process.env.WHATSAPP_QR_GATEWAY_URL?.replace(/\/$/, '') || null
  }

  private get headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    const token = process.env.WHATSAPP_QR_GATEWAY_TOKEN
    if (token) h['Authorization'] = `Bearer ${token}`
    return h
  }

  async sendText(to: string, text: string): Promise<SendResult> {
    const base = this.base
    const instance = this.conn.gateway_instance
    if (!base || !instance) {
      return { ok: false, error: 'Gateway de QR não configurado (instância ou URL ausente).' }
    }
    try {
      const res = await fetch(`${base}/instances/${instance}/send-text`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ to, text }),
        signal: AbortSignal.timeout(15_000),
      })
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        return { ok: false, error: `Gateway respondeu ${res.status}${body ? `: ${body.slice(0, 200)}` : ''}` }
      }
      const data = await res.json().catch(() => ({}))
      return { ok: true, messageId: data?.id || data?.messageId }
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Erro ao enviar (QR gateway)' }
    }
  }

  /** QR has no official templates — fall back to sending the resolved text. */
  async sendTemplate(args: SendTemplateArgs): Promise<SendResult> {
    // Without a real template body we can only send the variables joined as a
    // best-effort plain message. Callers that care should resolve the copy and
    // use sendText directly; this keeps automations from hard-failing.
    const fallback = args.variables.length
      ? args.variables.join(' ')
      : `(${args.templateName})`
    return this.sendText(args.to, fallback)
  }
}
