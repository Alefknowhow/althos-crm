import { createClient } from '@/lib/supabase/server'

const DEFAULT_MARKUP_PCT = 30

/**
 * Markup padrão do Althos Voice (%), lido da tabela `voice_pricing_config`
 * (1 linha global, editável só por super-admin). Único ponto do produto que
 * decide o markup — nunca hardcodear em componentes/actions.
 */
export async function getVoiceMarkupPct(): Promise<number> {
  const supabase = createClient()
  const { data } = await supabase.from('voice_pricing_config').select('markup_pct').limit(1).maybeSingle()
  return data?.markup_pct != null ? Number(data.markup_pct) : DEFAULT_MARKUP_PCT
}

/** Preço Althos (centavos) a partir do custo do provider (centavos) + markup. */
export function althosPrice(providerCostCents: number, markupPct: number = DEFAULT_MARKUP_PCT): number {
  return Math.ceil(providerCostCents * (1 + markupPct / 100))
}
