// Cookie consent — shared types/helpers between the banner and any future
// script that needs to check consent before loading non-essential trackers
// (analytics, marketing pixels). Categories mirror lib/legal/cookies.ts.

export type CookieCategory = 'preferences' | 'analytics' | 'thirdParty'

export type CookieConsent = {
  necessary: true
  preferences: boolean
  analytics: boolean
  thirdParty: boolean
  /** ISO timestamp of when the choice was made — lets us re-prompt if the policy changes later. */
  decidedAt: string
}

export const COOKIE_CONSENT_STORAGE_KEY = 'althos_cookie_consent'
/** Bump when the cookie categories/policy change meaningfully, to force a re-prompt. */
export const COOKIE_CONSENT_VERSION = 1

type StoredConsent = CookieConsent & { version: number }

export function readCookieConsent(): CookieConsent | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredConsent
    if (parsed.version !== COOKIE_CONSENT_VERSION) return null
    const { version: _version, ...consent } = parsed
    return consent
  } catch {
    return null
  }
}

export function writeCookieConsent(consent: Omit<CookieConsent, 'necessary' | 'decidedAt'>): CookieConsent {
  const full: CookieConsent = {
    necessary: true,
    preferences: consent.preferences,
    analytics: consent.analytics,
    thirdParty: consent.thirdParty,
    decidedAt: new Date().toISOString(),
  }
  if (typeof window !== 'undefined') {
    const stored: StoredConsent = { ...full, version: COOKIE_CONSENT_VERSION }
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(stored))
    window.dispatchEvent(new CustomEvent('althos-cookie-consent', { detail: full }))
  }
  return full
}
