export type ObjectiveGroup = 'leads' | 'messaging' | 'traffic' | 'sales' | 'awareness' | 'other'

export const OBJECTIVE_GROUP_LABELS: Record<ObjectiveGroup, string> = {
  leads: 'Geração de Leads',
  messaging: 'Mensagens (WhatsApp/Direct)',
  traffic: 'Tráfego',
  sales: 'Vendas',
  awareness: 'Reconhecimento',
  other: 'Outro',
}

/**
 * Mapeia o `objective` bruto da Meta (campaigns.objective) pra um grupo
 * usado no painel — determina qual métrica de conversão é a "certa" pra
 * mostrar por campanha (ver actions/marketing.ts, getMarketingOverview).
 *
 * OUTCOME_ENGAGEMENT cobre qualquer campanha de mensagens — WhatsApp,
 * Instagram Direct ou Messenger — a Meta não distingue o destino no
 * objetivo da campanha, só no nível do anúncio. Por isso o grupo se chama
 * "messaging" (Mensagens), não "whatsapp": rotular tudo como WhatsApp é
 * enganoso quando a campanha na verdade manda pro Direct do Instagram.
 */
export function classifyObjective(objective: string | null | undefined): ObjectiveGroup {
  const up = (objective || '').toUpperCase()
  switch (up) {
    case 'OUTCOME_LEADS':
    case 'LEAD_GENERATION':
      return 'leads'
    case 'OUTCOME_ENGAGEMENT':
    case 'MESSAGES':
    case 'ENGAGEMENT':
      return 'messaging'
    case 'OUTCOME_TRAFFIC':
    case 'LINK_CLICKS':
    case 'TRAFFIC':
      return 'traffic'
    case 'OUTCOME_SALES':
    case 'CONVERSIONS':
    case 'PRODUCT_CATALOG_SALES':
      return 'sales'
    case 'OUTCOME_AWARENESS':
    case 'BRAND_AWARENESS':
    case 'REACH':
      return 'awareness'
    default:
      return 'other'
  }
}
