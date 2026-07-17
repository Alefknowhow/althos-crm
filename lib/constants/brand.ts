/**
 * Althos CRM — brand identity constants.
 *
 * Single source of truth for product name, tagline, brand colors and
 * support contact channels. Plain module (no 'use client' / 'use server')
 * so it can be imported from both server and client components.
 */

export const BRAND = {
  name: 'Althos CRM',
  shortName: 'Althos',
  tagline: 'O CRM que cuida das suas vendas por você.',
  description:
    'Plataforma de CRM com automação de atendimento, IA e gestão de vendas para equipes que querem vender mais com menos esforço.',
  /** Domínio canônico de produção — base para metadataBase, OG/canonical absolutos. */
  domain: 'https://althoscrm.com.br',

  /** Brand indigo scale (mirrors tailwind `brand` color). */
  colors: {
    primary: '#4f46e5', // indigo-600
    primaryHover: '#4338ca', // indigo-700
    primaryLight: '#818cf8', // indigo-400 (dark mode)
    primaryHsl: '243 75% 59%',
    50: '#eef2ff',
    100: '#e0e7ff',
    200: '#c7d2fe',
    300: '#a5b4fc',
    400: '#818cf8',
    500: '#6366f1',
    600: '#4f46e5',
    700: '#4338ca',
    800: '#3730a3',
    900: '#312e81',
    950: '#1e1b4b',
  },

  /** Support channels. */
  support: {
    email: 'suporte@althoscrm.com.br',
    /**
     * WhatsApp number for human handoff from the support chat widget.
     * Digits only, with country code (no +, spaces or symbols).
     * Overridable per-deploy via NEXT_PUBLIC_SUPPORT_WHATSAPP.
     */
    whatsapp:
      process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP?.replace(/\D/g, '') || '',
  },
} as const

/**
 * Build a wa.me deep link to the support WhatsApp number with a
 * prefilled message. Returns null if no number is configured.
 */
export function supportWhatsappLink(message?: string): string | null {
  const num = BRAND.support.whatsapp
  if (!num) return null
  const base = `https://wa.me/${num}`
  return message ? `${base}?text=${encodeURIComponent(message)}` : base
}
