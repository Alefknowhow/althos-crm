/**
 * Ponto único de normalização/formatação de telefone — antes reimplementado
 * de forma divergente em lib/utils.ts, lib/meta/capi.ts, lib/nps/send-survey.ts
 * e actions/whatsapp-connection.ts (achado 2.1 da auditoria de segurança/
 * duplicação), o que arrisca dedup de lead por telefone divergir entre
 * WhatsApp, NPS e Meta CAPI.
 */

/** Só os dígitos, sem nenhuma suposição de DDI. */
export function toDigits(phone: string | null | undefined): string {
  if (!phone) return ''
  return phone.replace(/\D/g, '')
}

/** Dígitos com DDI garantido (assume Brasil, 55, quando o número não traz
 *  código de país — mesma heurística usada pelo Meta CAPI: 10-11 dígitos
 *  sem DDI vira `55` + dígitos). */
export function normalizePhoneE164BR(phone: string | null | undefined): string | undefined {
  const digits = toDigits(phone)
  if (!digits) return undefined
  if (digits.length <= 11) return `55${digits}`
  return digits
}

/** Formata telefone pra exibição: "+55 (DDD) 00000 0000". Assume DDI 55
 *  (Brasil) quando o número não traz código de país — cobre os formatos
 *  mais comuns salvos no CRM (com/sem 55, com/sem o 9º dígito). Sem
 *  padrão reconhecível, devolve o valor original em vez de quebrar. */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return ''
  const digits = toDigits(phone)
  let ddd = ''
  let rest = ''
  if (digits.length === 12 || digits.length === 13) {
    if (!digits.startsWith('55')) return phone
    ddd = digits.slice(2, 4)
    rest = digits.slice(4)
  } else if (digits.length === 10 || digits.length === 11) {
    ddd = digits.slice(0, 2)
    rest = digits.slice(2)
  } else {
    return phone
  }
  const restFormatted = rest.length === 9 ? `${rest.slice(0, 5)} ${rest.slice(5)}` : `${rest.slice(0, 4)} ${rest.slice(4)}`
  return `+55 (${ddd}) ${restFormatted}`
}
