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
 */
export const NICHE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'E-commerce',              label: 'E-commerce' },
  { value: 'Infoproduto',             label: 'Infoproduto' },
  { value: 'Comércio de Vendas',      label: 'Comércio de Vendas' },
  { value: 'Clínicas',                label: 'Clínicas' },
  { value: 'Escritório de Advogados', label: 'Escritório de Advogados' },
  { value: 'Agências',                label: 'Agências' },
  { value: 'Educação',                label: 'Educação' },
  { value: 'Imobiliária',             label: 'Imobiliária' },
  { value: NICHE_TRAVEL,              label: 'Agência de Viagens' },
  { value: 'Outros',                  label: 'Outros' },
]
