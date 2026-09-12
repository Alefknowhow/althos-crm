import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Reexportado por compatibilidade — a implementação real mora em lib/phone.ts
// (única fonte de normalização/formatação de telefone do repo).
export { formatPhoneDisplay } from '@/lib/phone'

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
