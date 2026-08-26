import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Formata telefone pra exibição: "+55 (DDD) 00000 0000". Assume DDI 55
 *  (Brasil) quando o número não traz código de país — cobre os formatos
 *  mais comuns salvos no CRM (com/sem 55, com/sem o 9º dígito). Sem
 *  padrão reconhecível, devolve o valor original em vez de quebrar. */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
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

export function slugify(text: string) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w-]+/g, '') // Remove all non-word chars
    .replace(/--+/g, '-') // Replace multiple - with single -
}

export function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100)
}

export function parseCurrency(value: string): number {
  const digits = value.replace(/\D/g, '')
  return parseInt(digits, 10) || 0
}
