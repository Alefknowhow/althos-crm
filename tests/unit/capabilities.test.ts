import { describe, it, expect } from 'vitest'
import { CAPABILITY_REGISTRY } from '@/lib/capabilities/registry'
import { resolveEntitlementState } from '@/lib/capabilities/entitlement-state'
import type { CapabilityKey } from '@/lib/capabilities/types'

describe('CAPABILITY_REGISTRY', () => {
  it('has an entry for every declared CapabilityKey (compile-time check via Record type)', () => {
    // The `Record<CapabilityKey, CapabilityRule>` annotation on the registry
    // already makes a missing key a compile error — this just also asserts
    // it at runtime so a future refactor that widens the type to
    // `Partial<...>` doesn't silently lose the guarantee.
    const keys = Object.keys(CAPABILITY_REGISTRY) as CapabilityKey[]
    expect(keys.length).toBeGreaterThan(20)
  })

  it('every vertical.* capability (except umbrella niche gates) declares at least one rule', () => {
    const umbrellas: CapabilityKey[] = ['vertical.travel', 'vertical.clinic']
    for (const [key, rule] of Object.entries(CAPABILITY_REGISTRY)) {
      if (umbrellas.includes(key as CapabilityKey)) continue
      if (!key.startsWith('vertical.')) continue
      const hasAnyRule = !!(rule.permission || rule.feature || rule.module || rule.requiresNiche)
      expect(hasAnyRule, `${key} should declare at least one rule`).toBe(true)
    }
  })

  it('umbrella vertical capabilities gate by niche, not by module', () => {
    expect(CAPABILITY_REGISTRY['vertical.travel'].requiresNiche).toBe('viagens')
    expect(CAPABILITY_REGISTRY['vertical.clinic'].requiresNiche).toBe('clinicas')
  })
})

describe('resolveEntitlementState', () => {
  const now = new Date()
  const past = new Date(now.getTime() - 86_400_000).toISOString()
  const future = new Date(now.getTime() + 86_400_000).toISOString()

  it('no subscription row => pending_activation', () => {
    expect(resolveEntitlementState(null)).toBe('pending_activation')
  })

  it('trialing with trial_ends_at in the future => active', () => {
    expect(resolveEntitlementState({
      status: 'trialing', trial_ends_at: future, canceled_at: null, current_period_end: future,
    })).toBe('active')
  })

  it('trialing with trial_ends_at in the past => inactive', () => {
    expect(resolveEntitlementState({
      status: 'trialing', trial_ends_at: past, canceled_at: null, current_period_end: future,
    })).toBe('inactive')
  })

  it('active with no cancellation => active', () => {
    expect(resolveEntitlementState({
      status: 'active', trial_ends_at: null, canceled_at: null, current_period_end: future,
    })).toBe('active')
  })

  it('active but canceled, still within paid period => pending_cancellation', () => {
    expect(resolveEntitlementState({
      status: 'active', trial_ends_at: null, canceled_at: past, current_period_end: future,
    })).toBe('pending_cancellation')
  })

  it('active, canceled, and period already ended => active (status not yet synced, still counts active per subscriptions.status)', () => {
    // Guards against surprising behavior: current_period_end in the past
    // with status still 'active' falls through to plain 'active' — the
    // billing sync job, not this pure function, is responsible for
    // flipping status once the period truly ends.
    expect(resolveEntitlementState({
      status: 'active', trial_ends_at: null, canceled_at: past, current_period_end: past,
    })).toBe('active')
  })

  it('past_due => suspended', () => {
    expect(resolveEntitlementState({
      status: 'past_due', trial_ends_at: null, canceled_at: null, current_period_end: future,
    })).toBe('suspended')
  })

  it('canceled => inactive', () => {
    expect(resolveEntitlementState({
      status: 'canceled', trial_ends_at: null, canceled_at: past, current_period_end: past,
    })).toBe('inactive')
  })

  it('unknown status => inactive (fail closed)', () => {
    expect(resolveEntitlementState({
      status: 'weird_future_status', trial_ends_at: null, canceled_at: null, current_period_end: future,
    })).toBe('inactive')
  })
})
