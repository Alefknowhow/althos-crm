// Niche (vertical) helpers. Niche is stored on organizations.niche and gates
// vertical-specific tabs/features. Keep this list as the single source of truth.

export const NICHE_TRAVEL = 'viagens'

export type Niche = typeof NICHE_TRAVEL | string

export function isTravelNiche(niche?: string | null): boolean {
  const n = (niche || '').toLowerCase()
  return n === NICHE_TRAVEL || n.includes('viag') || n.includes('travel')
}

/**
 * Selectable niches. `value` is what gets stored on organizations.niche;
 * `label` is the display name. The travel value (NICHE_TRAVEL) unlocks the
 * travel-agency tabs (Propostas, Vendas Viagem, etc.).
 *
 * Alinhado aos 5 nichos estratégicos definidos (ver docs/inventario-funcionalidades.md
 * e lib/landing/niches.ts, usado no site institucional): Viagens, Clínicas,
 * Imobiliárias, Advocacia e Corretoras de Seguros. "Outros" é o catch-all pra
 * quem não se encaixa em nenhum — continua usando o CRM genérico.
 */
export const NICHE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: NICHE_TRAVEL,   label: 'Agência de Viagens' },
  { value: 'Clínicas',     label: 'Clínicas' },
  { value: 'Imobiliária',  label: 'Imobiliárias' },
  { value: 'advocacia',    label: 'Advocacia' },
  { value: 'seguros',      label: 'Corretora de Seguros' },
  { value: 'Outros',       label: 'Outros' },
]
