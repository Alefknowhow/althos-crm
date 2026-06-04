import { Resend } from 'resend'

/**
 * Remetente padrão (campo "from") dos e-mails transacionais.
 * Configurável por deploy via RESEND_FROM — assim o endereço pode ser
 * trocado sem mexer no código. Use o formato "Nome <email@dominio>".
 * O domínio precisa estar verificado no Resend.
 */
export const EMAIL_FROM =
  process.env.RESEND_FROM || 'Althos CRM <noreply@send.althoscrm.com.br>'

// Lazy singleton — only instantiated when first used (not at module load time).
// This avoids build-time errors when RESEND_API_KEY is not set.
let _resend: Resend | null = null

export function getResend(): Resend {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY environment variable is not set')
    }
    _resend = new Resend(process.env.RESEND_API_KEY)
  }
  return _resend
}

// Legacy named export kept for backwards compatibility with existing imports.
// Accessing this at module-load time is safe because it returns a Proxy that
// defers the real instantiation until a method is actually called.
export const resend: Resend = new Proxy({} as Resend, {
  get(_target, prop) {
    return (getResend() as any)[prop]
  },
})
