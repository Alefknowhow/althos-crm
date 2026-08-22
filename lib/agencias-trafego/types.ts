/**
 * Vertical Agências de Tráfego — tipos conceituais (Etapa 1: fundação).
 *
 * Nenhuma dessas entidades tem tabela no banco ainda — são o contrato
 * futuro descrito no prompt de fundação, pra a evolução incremental (cada
 * tela especificada depois) não precisar redesenhar os tipos do zero.
 * Campos são só o mínimo óbvio de cada entidade (id, organização, nome,
 * timestamps) — regra de negócio, cálculo e relacionamento definitivo
 * ficam pras próximas etapas, quando cada tela for especificada.
 */

export type ID = string
export type ISODateString = string

interface BaseEntity {
  id: ID
  organizationId: ID
  createdAt: ISODateString
  updatedAt: ISODateString
}

export interface Agency extends BaseEntity {
  name: string
}

export interface Client extends BaseEntity {
  name: string
  status: 'ativo' | 'inativo' | 'pausado'
}

export interface Campaign extends BaseEntity {
  clientId: ID
  name: string
  platform: string
}

export interface AdSet extends BaseEntity {
  campaignId: ID
  name: string
}

export interface Ad extends BaseEntity {
  adSetId: ID
  name: string
}

export interface Lead extends BaseEntity {
  clientId: ID
  campaignId: ID | null
  name: string | null
  contactId: ID | null
}

export interface Opportunity extends BaseEntity {
  leadId: ID
  clientId: ID
  status: string
}

export interface Sale extends BaseEntity {
  opportunityId: ID
  clientId: ID
  amountCents: number
}

export interface Revenue extends BaseEntity {
  clientId: ID
  amountCents: number
  period: string
}

export interface Goal extends BaseEntity {
  clientId: ID | null
  metric: string
  targetValue: number
  period: string
}

export interface TeamMember extends BaseEntity {
  userId: ID
  role: string
}

export interface Expense extends BaseEntity {
  clientId: ID | null
  description: string
  amountCents: number
}

export interface Report extends BaseEntity {
  clientId: ID | null
  title: string
}

export interface Alert extends BaseEntity {
  clientId: ID | null
  message: string
  severity: 'info' | 'warning' | 'critical'
}

// ── Métricas (só chaves — sem fórmula/cálculo nesta etapa) ────────────────

export type MediaMetricKey = 'investment' | 'impressions' | 'reach' | 'clicks' | 'ctr' | 'cpc'
export type LeadMetricKey = 'leads' | 'cpl' | 'qualifiedLeads' | 'cpql'
export type ComercialMetricKey = 'opportunities' | 'sales' | 'conversionRate' | 'cac' | 'ticketAverage'
export type ReceitaMetricKey = 'revenue' | 'roas' | 'roi'
export type AgenciaMetricKey = 'mrr' | 'arr' | 'ltv' | 'churn' | 'activeClients' | 'newClients' | 'lostClients'
