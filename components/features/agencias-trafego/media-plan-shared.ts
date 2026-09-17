import type { MediaPlanLevel, MediaPlanPlatform } from '@/actions/media-plans'

export type MediaPlanCreative = { id: string; title: string }

export const PLATFORM_LABEL: Record<MediaPlanPlatform, string> = {
  meta: 'Meta Ads', google: 'Google Ads', tiktok: 'TikTok Ads', linkedin: 'LinkedIn Ads', gpt_ads: 'GPT Ads', other: 'Outra',
}
export const PLATFORM_CONNECTED: Record<MediaPlanPlatform, boolean> = {
  meta: true, google: false, tiktok: false, linkedin: false, gpt_ads: false, other: false,
}
export const LEVEL_LABEL: Record<MediaPlanLevel, string> = { campaign: 'Campanha', adset: 'Conjunto', ad: 'Anúncio' }
export const CHILD_LEVEL: Record<MediaPlanLevel, MediaPlanLevel | null> = { campaign: 'adset', adset: 'ad', ad: null }

/**
 * Estrutura real de cada plataforma — nem toda plataforma tem 3 níveis.
 * LinkedIn Ads não tem "conjunto/grupo": a segmentação de público mora na
 * própria campanha, e o anúncio pendura direto nela (2 níveis). As outras
 * (Meta, Google, TikTok, GPT Ads) seguem Campanha → Grupo → Anúncio — nomes
 * do nível do meio variam por plataforma (Conjunto na Meta, Grupo de
 * Anúncios no resto), por isso o label é definido aqui, por plataforma,
 * em vez de usar sempre LEVEL_LABEL genérico.
 */
export const PLATFORM_HAS_ADSET_LEVEL: Record<MediaPlanPlatform, boolean> = {
  meta: true, google: true, tiktok: true, gpt_ads: true, linkedin: false, other: true,
}
export const PLATFORM_ADSET_LABEL: Record<MediaPlanPlatform, string> = {
  meta: 'Conjuntos', google: 'Grupos de Anúncios', tiktok: 'Grupos de Anúncios',
  gpt_ads: 'Grupos de Anúncios', linkedin: 'Grupos de Anúncios', other: 'Conjuntos',
}

export function centsFromInput(v: string): number | null {
  const n = Number(v.replace(/\D/g, ''))
  return Number.isFinite(n) && v.trim() !== '' ? n * 100 : null
}
export function reaisFromCents(c: number | null | undefined): string {
  return c != null ? String(Math.round(c / 100)) : ''
}
