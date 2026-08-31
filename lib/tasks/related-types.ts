import { isTravelNiche, isRealEstateNiche } from '@/lib/niche'

/** Tipo de "Relacionado a" — 'contato' e 'reserva' mapeiam pra colunas reais
 *  (contato_id / sale_id na tabela tasks); os demais usam o par genérico
 *  related_entity_type/related_entity_id (ver actions/tasks.ts). */
export type RelatedTypeValue = 'contato' | 'reserva' | 'travel_proposal' | 'appointment' | 'sale' | 'property_deal' | 'property_proposal'

export const RELATED_TYPE_LABELS: Record<RelatedTypeValue, string> = {
  contato: 'Contato',
  reserva: 'Reserva',
  travel_proposal: 'Cotação',
  appointment: 'Agendamento',
  sale: 'Venda',
  property_deal: 'Negócio imobiliário',
  property_proposal: 'Proposta imobiliária',
}

/** Opções de tipo, filtradas pelo nicho da org — mesma regra usada no
 *  TaskDialog e no filtro "Relacionado a" do TasksBoard. */
export function relatedTypeOptions(niche?: string | null): { value: RelatedTypeValue; label: string }[] {
  const travel = isTravelNiche(niche)
  const realEstate = isRealEstateNiche(niche)
  const opts: RelatedTypeValue[] = ['contato']
  if (travel) opts.push('reserva', 'travel_proposal')
  opts.push('appointment')
  if (!travel && !realEstate) opts.push('sale')
  if (realEstate) opts.push('property_deal', 'property_proposal')
  return opts.map(value => ({ value, label: RELATED_TYPE_LABELS[value] }))
}
