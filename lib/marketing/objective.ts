export type ObjectiveGroup = 'leads' | 'whatsapp' | 'traffic' | 'sales' | 'awareness' | 'other'

export const OBJECTIVE_GROUP_LABELS: Record<ObjectiveGroup, string> = {
  leads: 'Geração de Leads',
  whatsapp: 'WhatsApp',
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
 * OUTCOME_ENGAGEMENT cobre tanto engajamento genérico de post quanto
 * Click-to-WhatsApp — na prática das campanhas do Althos CRM isso é
 * sempre WhatsApp, mas fica marcado aqui caso precise refinar depois.
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
      return 'whatsapp'
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
