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

/** Normaliza o `ai_tier` de um lead (pt-BR ou en) pro balde usado nos filtros do Kanban. */
export function tierBucket(t?: string | null): 'hot' | 'warm' | 'cold' | null {
  const v = (t || '').toLowerCase()
  if (v === 'hot' || v === 'quente') return 'hot'
  if (v === 'warm' || v === 'morno') return 'warm'
  if (v === 'cold' || v === 'frio') return 'cold'
  return null
}
