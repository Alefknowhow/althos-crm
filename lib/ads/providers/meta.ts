/**
 * Adapter Meta do Ads Tool Layer (#22, passo 3.1) — embrulha `lib/meta/ads.ts`,
 * nunca reimplementa chamada HTTP aqui. Capabilities de leitura `true`;
 * escrita fica `false` até 3.8 (atrás de `META_ADS_WRITE_ENABLED`).
 */

import type { AdsCapabilities, AdsProviderAdapter, AdsAccount, AdsCampaign, AdsAdSet, AdsAd, AdsInsight } from '@/lib/ads/types'

const WRITE_ENABLED = process.env.META_ADS_WRITE_ENABLED === 'true'

export const metaAdsCapabilities: AdsCapabilities = {
  readAccounts: true,
  readCampaigns: true,
  readAdSets: true,
  readAds: true,
  readInsights: true,
  readSearchTerms: false, // não implementado ainda — Meta expõe via Search Terms Report, fora do escopo desta fase
  pauseCampaign: WRITE_ENABLED,
  resumeCampaign: WRITE_ENABLED,
  updateBudget: WRITE_ENABLED,
  createCampaign: false,
  uploadOfflineConversion: false, // CAPI já cobre isso por outro caminho (lib/meta/capi.ts)
}

export const metaAdsAdapter: AdsProviderAdapter = {
  provider: 'meta',
  capabilities: metaAdsCapabilities,

  async fetchCampaigns(adAccountExternalId, token): Promise<AdsCampaign[]> {
    const { fetchMetaCampaigns } = await import('@/lib/meta/ads')
    const campaigns = await fetchMetaCampaigns(adAccountExternalId, token)
    return campaigns.map(c => ({ id: c.id, name: c.name, status: (c.status || '').toLowerCase(), objective: c.objective, raw: c }))
  },

  async fetchAdSets(campaignExternalId, token): Promise<AdsAdSet[]> {
    const { fetchMetaAdSets } = await import('@/lib/meta/ads')
    const adSets = await fetchMetaAdSets(campaignExternalId, token)
    return adSets.map(a => ({
      id: a.id,
      name: a.name,
      status: (a.effective_status || a.status || '').toLowerCase(),
      dailyBudgetCents: a.daily_budget ? Number(a.daily_budget) : null,
      raw: a,
    }))
  },

  async fetchAds(adSetExternalId, token): Promise<AdsAd[]> {
    const { fetchMetaAds } = await import('@/lib/meta/ads')
    const ads = await fetchMetaAds(adSetExternalId, token)
    return ads.map(a => ({ id: a.id, name: a.name, status: (a.effective_status || a.status || '').toLowerCase(), raw: a }))
  },

  async fetchInsights(entityExternalId, token, since, until): Promise<AdsInsight[]> {
    const { fetchMetaInsights } = await import('@/lib/meta/ads')
    const insights = await fetchMetaInsights(entityExternalId, token, since, until)
    return insights.map(i => ({
      entityId: i.entity_id,
      date: i.date,
      impressions: i.impressions,
      clicks: i.clicks,
      spendCents: i.spend_cents,
      leads: i.meta_leads,
      purchases: i.meta_purchases,
      purchaseValueCents: i.meta_purchase_value_cents,
      raw: i,
    }))
  },

  // pauseCampaign/resumeCampaign/updateAdSetBudget: implementados na 3.8,
  // atrás de META_ADS_WRITE_ENABLED. Ausentes aqui até lá (capability já
  // reporta false, então getAdsAdapter nunca deveria chamá-los antes).

  async fetchAccounts(): Promise<AdsAccount[]> {
    // ad_accounts já é lido direto do Supabase (não da Meta) em todo o
    // resto do app — não duplicar aqui. Mantido só pra satisfazer a
    // interface caso um consumidor futuro precise da lista ao vivo.
    throw new Error('fetchAccounts: use a tabela ad_accounts (Supabase), não a Graph API, pra listar contas conectadas')
  },
}
