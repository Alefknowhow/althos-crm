import type { MockBarRow } from './MockBarListCard'
import type { MockSegment } from './MockDonutCard'

export const MOCK_CUSTOMER_SEGMENTS: MockSegment[] = [
  { label: 'VIP', pct: 18, color: '#f1c21b' },
  { label: 'Recorrente', pct: 34, color: '#0f62fe' },
  { label: 'Novo', pct: 48, color: '#8d8d8d' },
]

export const MOCK_NEW_VS_RETURNING: MockSegment[] = [
  { label: 'Novos clientes', pct: 62, color: '#24a148' },
  { label: 'Recorrentes', pct: 38, color: '#0f62fe' },
]

export const MOCK_CAMPAIGN_ROAS: MockBarRow[] = [
  { label: 'Campanha Verão — Conversão', value: 4.8, valueLabel: '4.8x ROAS' },
  { label: 'Retargeting Carrinho', value: 3.6, valueLabel: '3.6x ROAS' },
  { label: 'Alcance Institucional', value: 1.2, valueLabel: '1.2x ROAS' },
]

export const MOCK_TOP_CUSTOMERS: MockBarRow[] = [
  { label: 'Maria Fernandes', value: 8, valueLabel: '8 compras' },
  { label: 'Carlos Eduardo', value: 6, valueLabel: '6 compras' },
  { label: 'Juliana Prado', value: 5, valueLabel: '5 compras' },
  { label: 'Ricardo Alves', value: 4, valueLabel: '4 compras' },
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
