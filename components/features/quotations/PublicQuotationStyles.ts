/**
 * The public quotation view's CSS, as a template string injected via
 * <style>{CSS}</style> -- a straight port of the design handoff HTML.
 * Split out of PublicQuotationView.tsx (it's a single unbroken template
 * literal, so it can't be usefully split further).
 *
 * The CSS itself is split across three parts (pure string data, split at
 * rule boundaries — concatenation order matters, content unchanged):
 *   - PublicQuotationStyles-1.ts: base/tokens through lightbox
 *   - PublicQuotationStyles-2.ts: aéreo/mapa/itinerário/investimento
 *   - PublicQuotationStyles-3.ts: fechamento/rodapé/modal/mobile/print
 */
import { CSS_1 } from './PublicQuotationStyles-1'
import { CSS_2 } from './PublicQuotationStyles-2'
import { CSS_3 } from './PublicQuotationStyles-3'

export function urlHref(u: string) { return /^https?:\/\//.test(u) ? u : `https://${u}` }
export function igHref(u: string) {
  const handle = u.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '')
  return /^https?:\/\//.test(u) ? u : `https://instagram.com/${handle}`
}

export const CSS = CSS_1 + CSS_2 + CSS_3
