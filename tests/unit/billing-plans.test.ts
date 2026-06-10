import { describe, it, expect } from 'vitest'
import { getPlan, isAccessBlocked, getPlanPricing, PLANS } from '@/lib/billing/plans'

describe('getPlan', () => {
  it('resolves a known plan', () => {
    expect(getPlan('pro').key).toBe('pro')
  })

  it('resolves the grandfathered "scale" alias to the Business config', () => {
    expect(getPlan('scale').label).toBe('Business')
  })

  it('defaults unknown/null plans to trial', () => {
    expect(getPlan(null).key).toBe('trial')
    expect(getPlan(undefined).key).toBe('trial')
    expect(getPlan('does-not-exist').key).toBe('trial')
  })
})

describe('isAccessBlocked', () => {
  const future = new Date(Date.now() + 7 * 86_400_000).toISOString()
  const past = new Date(Date.now() - 86_400_000).toISOString()

  it('never blocks unmanaged plans (free/agency/internal)', () => {
    for (const plan of ['free', 'agency', 'internal']) {
      expect(
        isAccessBlocked({
          plan,
          trial_ends_at: past,
          subscription_status: 'canceled',
          billing_managed_externally: false,
        }),
      ).toBe(false)
    }
  })

  it('never blocks when billing is managed externally', () => {
    expect(
      isAccessBlocked({
        plan: 'pro',
        trial_ends_at: past,
        subscription_status: 'canceled',
        billing_managed_externally: true,
      }),
    ).toBe(false)
  })

  it('blocks an expired trial but not an active one', () => {
    expect(
      isAccessBlocked({
        plan: 'trial',
        trial_ends_at: past,
        subscription_status: null,
        billing_managed_externally: false,
      }),
    ).toBe(true)
    expect(
      isAccessBlocked({
        plan: 'trial',
        trial_ends_at: future,
        subscription_status: null,
        billing_managed_externally: false,
      }),
    ).toBe(false)
  })

  it('does not block a trial with no end date set', () => {
    expect(
      isAccessBlocked({
        plan: 'trial',
        trial_ends_at: null,
        subscription_status: null,
        billing_managed_externally: false,
      }),
    ).toBe(false)
  })

  it('blocks a paid plan whose subscription was canceled', () => {
    expect(
      isAccessBlocked({
        plan: 'pro',
        trial_ends_at: null,
        subscription_status: 'canceled',
        billing_managed_externally: false,
      }),
    ).toBe(true)
    expect(
      isAccessBlocked({
        plan: 'pro',
        trial_ends_at: null,
        subscription_status: 'active',
        billing_managed_externally: false,
      }),
    ).toBe(false)
  })
})

describe('getPlanPricing', () => {
  it('computes per-month equivalent and savings for the annual cycle', () => {
    const p = getPlanPricing(PLANS.pro, 'annual')
    expect(p.cycle).toBe('annual')
    expect(p.totalCents).toBe(390648)
    expect(p.perMonthCents).toBe(Math.round(390648 / 12))
    expect(p.fullYearCents).toBe(39700 * 12)
    expect(p.savedCents).toBe(39700 * 12 - 390648)
    expect(p.savedCents).toBeGreaterThan(0)
  })

  it('reports zero savings on the monthly cycle', () => {
    const p = getPlanPricing(PLANS.pro, 'monthly')
    expect(p.cycle).toBe('monthly')
    expect(p.totalCents).toBe(39700)
    expect(p.perMonthCents).toBe(39700)
    expect(p.savedCents).toBe(0)
  })

  it('falls back to monthly when a cycle price is unavailable', () => {
    // trial has null semestral/annual prices → falls back to the monthly branch
    const p = getPlanPricing(PLANS.trial, 'annual')
    expect(p.cycle).toBe('monthly')
    expect(p.totalCents).toBe(0)
  })
})
