import { sendTextMessage, sendTemplateMessage } from '../meta-client'
import type {
  WhatsAppProvider, WhatsAppConnection, SendResult, SendTemplateArgs,
} from '../types'

/**
 * Official Meta Cloud API provider.
 *
 * Thin wrapper over the existing meta-client helpers so we don't duplicate the
 * Graph API logic. It adapts a whatsapp_connections row into the legacy
 * `orgConfig`-shaped object those helpers expect.
 */
export class MetaCloudProvider implements WhatsAppProvider {
  readonly kind = 'cloud_api' as const
  readonly supportsTemplates = true

  constructor(private readonly conn: WhatsAppConnection) {}

  private get orgConfig() {
    return {
      whatsapp_phone_number_id: this.conn.phone_number_id,
      whatsapp_access_token: this.conn.access_token,
    }
  }

  async sendText(to: string, text: string): Promise<SendResult> {
    try {
      const res = await sendTextMessage(this.orgConfig, to, text)
      return { ok: true, messageId: res?.messages?.[0]?.id }
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Erro ao enviar (Cloud API)' }
    }
  }

  async sendTemplate(args: SendTemplateArgs): Promise<SendResult> {
    try {
      const res = await sendTemplateMessage(
        this.orgConfig,
        args.to,
        args.templateName,
        args.variables,
        args.languageCode || 'pt_BR',
        args.headerType,
        args.headerMediaUrl,
      )
      return { ok: true, messageId: res?.messages?.[0]?.id }
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Erro ao enviar template (Cloud API)' }
    }
  }
}
