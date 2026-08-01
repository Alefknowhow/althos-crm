import type { MockBarRow } from './MockBarListCard'

export const MOCK_CAMPAIGN_ROAS: MockBarRow[] = [
  { label: 'Campanha Verão — Conversão', value: 4.8, valueLabel: '4.8x ROAS' },
  { label: 'Retargeting Carrinho', value: 3.6, valueLabel: '3.6x ROAS' },
  { label: 'Alcance Institucional', value: 1.2, valueLabel: '1.2x ROAS' },
]

export const MOCK_CONVERSION_BY_SELLER: MockBarRow[] = [
  { label: 'Ana Souza', value: 42, valueLabel: '42%' },
  { label: 'Bruno Lima', value: 31, valueLabel: '31%' },
  { label: 'Camila Reis', value: 24, valueLabel: '24%' },
]

export const MOCK_ASSIGNED_VS_WORKED: MockBarRow[] = [
  { label: 'Ana Souza', value: 92, valueLabel: '92% trabalhados' },
  { label: 'Bruno Lima', value: 78, valueLabel: '78% trabalhados' },
  { label: 'Camila Reis', value: 65, valueLabel: '65% trabalhados' },
]
