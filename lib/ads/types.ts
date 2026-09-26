/**
 * Ads Tool Layer (issue #22, passo 3.1) — camada de abstração sobre
 * providers de anúncio (Meta, futuro Google), mesmo padrão de
 * `lib/storage/index.ts` (`StorageService`) e `lib/voice/provider.ts`
 * (`VoiceProvider`): tools/agente chamam sempre a interface, nunca o SDK
 * do provider diretamente. Tipos normalizados, mas sem forçar equivalência
 * entre providers — cada um pode devolver campos extras em `raw`.
 */

export type AdsProviderName = 'meta' | 'google'

export class AdsCapabilityError extends Error {
  constructor(provider: AdsProviderName, capability: string) {
    super(`Provider "${provider}" não suporta a capability "${capability}"`)
    this.name = 'AdsCapabilityError'
  }
}

export type AdsCapabilities = {
  readAccounts: boolean
  readCampaigns: boolean
  readAdSets: boolean
  readAds: boolean
  readInsights: boolean
  readSearchTerms: boolean
  pauseCampaign: boolean
  resumeCampaign: boolean
  updateBudget: boolean
  createCampaign: boolean
  uploadOfflineConversion: boolean
}

export type AdsAccount = { id: string; name: string; externalId: string; status: string; raw?: unknown }
export type AdsCampaign = { id: string; name: string; status: string; objective: string | null; raw?: unknown }
export type AdsAdSet = { id: string; name: string; status: string; dailyBudgetCents: number | null; raw?: unknown }
export type AdsAd = { id: string; name: string; status: string; raw?: unknown }
export type AdsInsight = {
  entityId: string
  date: string
  impressions: number
  clicks: number
  spendCents: number
  leads: number
  purchases: number
  purchaseValueCents: number
  raw?: unknown
}
export type AdsSearchTerm = { term: string; impressions: number; clicks: number; spendCents: number; raw?: unknown }

export type AdsMutationResult = { ok: true; before: unknown; after: unknown } | { ok: false; error: string }

export interface AdsProviderAdapter {
  readonly provider: AdsProviderName
  readonly capabilities: AdsCapabilities

  fetchAccounts?(token: string): Promise<AdsAccount[]>
  fetchCampaigns?(adAccountExternalId: string, token: string): Promise<AdsCampaign[]>
  fetchAdSets?(campaignExternalId: string, token: string): Promise<AdsAdSet[]>
  fetchAds?(adSetExternalId: string, token: string): Promise<AdsAd[]>
  fetchInsights?(entityExternalId: string, token: string, since: string, until: string): Promise<AdsInsight[]>
  fetchSearchTerms?(campaignExternalId: string, token: string, since: string, until: string): Promise<AdsSearchTerm[]>

  pauseCampaign?(campaignExternalId: string, token: string): Promise<AdsMutationResult>
  resumeCampaign?(campaignExternalId: string, token: string): Promise<AdsMutationResult>
  updateAdSetBudget?(adSetExternalId: string, dailyBudgetCents: number, token: string): Promise<AdsMutationResult>
}
