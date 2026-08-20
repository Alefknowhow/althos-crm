import type { MockBarRow } from './MockBarListCard'

export const MOCK_CAMPAIGN_ROAS: MockBarRow[] = [
  { label: 'Campanha Verão — Conversão', value: 4.8, valueLabel: '4.8x ROAS' },
  { label: 'Retargeting Carrinho', value: 3.6, valueLabel: '3.6x ROAS' },
  { label: 'Alcance Institucional', value: 1.2, valueLabel: '1.2x ROAS' },
]

// Não existe campo de motivo de perda em contatos/pipeline_stages hoje —
// precisaria de uma migration nova (ex.: contatos.lost_reason) pra virar
// dado real. Mock claramente rotulado (MockBarListCard) até essa decisão
// de schema ser tomada.
export const MOCK_LOSS_REASONS: MockBarRow[] = [
  { label: 'Preço', value: 34, valueLabel: '34%' },
  { label: 'Sem resposta', value: 28, valueLabel: '28%' },
  { label: 'Concorrente', value: 18, valueLabel: '18%' },
  { label: 'Timing', value: 12, valueLabel: '12%' },
  { label: 'Outros', value: 8, valueLabel: '8%' },
]

