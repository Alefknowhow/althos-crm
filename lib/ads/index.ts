import type { AdsProviderAdapter, AdsProviderName } from '@/lib/ads/types'
import { metaAdsAdapter } from '@/lib/ads/providers/meta'
import { googleAdsAdapter } from '@/lib/ads/providers/google'

export * from '@/lib/ads/types'

export function getAdsAdapter(provider: AdsProviderName): AdsProviderAdapter {
  switch (provider) {
    case 'meta': return metaAdsAdapter
    case 'google': return googleAdsAdapter
  }
}

/**
 * Resolve o token server-side do provider pra uma org — nunca retornado a
 * tool/LLM, só usado internamente pra chamar o adapter. Meta: valida
 * também a expiração conhecida (`meta_ads_token_expires_at`), mas não
 * tenta refresh aqui (mesmo comportamento já usado em
 * actions/marketing-drilldown.ts — token expirado só é descoberto na
 * prática quando a chamada à Graph API falha com erro 190).
 */
export async function resolveAdsToken(
  supabaseAdmin: { from: (table: string) => any },
  orgId: string,
  provider: AdsProviderName,
): Promise<string | null> {
  if (provider === 'google') return null // sem integração viva

  const { data } = await supabaseAdmin
    .from('organizations')
    .select('meta_ads_access_token')
    .eq('id', orgId)
    .maybeSingle()
  return data?.meta_ads_access_token || null
}
