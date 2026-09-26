/**
 * Stub Google Ads do Ads Tool Layer (#22, passo 3.1) — sem integração viva
 * (sem OAuth/developer token). Todas as capabilities `false`; qualquer
 * método chamado lança `AdsCapabilityError` com mensagem clara, nunca
 * silenciosamente retorna vazio (evita o agente/tool achar que "não há
 * dados" quando na verdade o provider não está implementado).
 */

import type { AdsCapabilities, AdsProviderAdapter } from '@/lib/ads/types'
import { AdsCapabilityError } from '@/lib/ads/types'

export const googleAdsCapabilities: AdsCapabilities = {
  readAccounts: false,
  readCampaigns: false,
  readAdSets: false,
  readAds: false,
  readInsights: false,
  readSearchTerms: false,
  pauseCampaign: false,
  resumeCampaign: false,
  updateBudget: false,
  createCampaign: false,
  uploadOfflineConversion: false,
}

function unsupported(capability: string): never {
  throw new AdsCapabilityError('google', capability)
}

export const googleAdsAdapter: AdsProviderAdapter = {
  provider: 'google',
  capabilities: googleAdsCapabilities,
  async fetchAccounts() { unsupported('readAccounts') },
  async fetchCampaigns() { unsupported('readCampaigns') },
  async fetchAdSets() { unsupported('readAdSets') },
  async fetchAds() { unsupported('readAds') },
  async fetchInsights() { unsupported('readInsights') },
  async fetchSearchTerms() { unsupported('readSearchTerms') },
}
