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

export function centsFromInput(v: string): number | null {
  const n = Number(v.replace(/\D/g, ''))
  return Number.isFinite(n) && v.trim() !== '' ? n * 100 : null
}
export function reaisFromCents(c: number | null | undefined): string {
  return c != null ? String(Math.round(c / 100)) : ''
}
