import { describe, it, expect } from 'vitest'
import { parseCreditPackRef, resolvePlanKeyFromOrg, buildAsaasDedupeKey } from '@/lib/asaas/webhook-helpers'

describe('parseCreditPackRef', () => {
  it('parses a well-formed credit_pack reference', () => {
    expect(parseCreditPackRef('credit_pack:acc-123:500')).toEqual({ accountId: 'acc-123', credits: 500 })
  })

  it('returns null for a non credit_pack reference', () => {
    expect(parseCreditPackRef('subscription:acc-123')).toBeNull()
    expect(parseCreditPackRef(null)).toBeNull()
    expect(parseCreditPackRef(undefined)).toBeNull()
    expect(parseCreditPackRef('')).toBeNull()
  })

  it('returns null when credits is not a valid number (never credits NaN)', () => {
    expect(parseCreditPackRef('credit_pack:acc-123:not-a-number')).toBeNull()
  })

  it('returns null when accountId is missing', () => {
    expect(parseCreditPackRef('credit_pack::500')).toBeNull()
  })
})

describe('resolvePlanKeyFromOrg', () => {
  it('passes through known plan keys', () => {
    expect(resolvePlanKeyFromOrg('pro')).toBe('pro')
    expect(resolvePlanKeyFromOrg('business')).toBe('business')
    expect(resolvePlanKeyFromOrg('scale')).toBe('scale')
  })

  it('falls back to starter for unknown/null/trial plan values', () => {
    expect(resolvePlanKeyFromOrg('trial')).toBe('starter')
    expect(resolvePlanKeyFromOrg('free')).toBe('starter')
    expect(resolvePlanKeyFromOrg(null)).toBe('starter')
    expect(resolvePlanKeyFromOrg(undefined)).toBe('starter')
  })
})

describe('buildAsaasDedupeKey', () => {
  it('builds a stable key from event + payment id', () => {
    expect(buildAsaasDedupeKey({ event: 'PAYMENT_CONFIRMED', payment: { id: 'pay_1' } })).toBe('PAYMENT_CONFIRMED:pay_1')
  })

  it('falls back to subscription id when there is no payment', () => {
    expect(buildAsaasDedupeKey({ event: 'SUBSCRIPTION_DELETED', subscription: { id: 'sub_1' } })).toBe('SUBSCRIPTION_DELETED:sub_1')
  })

  it('produces the SAME key for the same event replayed (the whole point of idempotency)', () => {
    const payload = { event: 'PAYMENT_CONFIRMED', payment: { id: 'pay_1' } }
    expect(buildAsaasDedupeKey(payload)).toBe(buildAsaasDedupeKey({ ...payload }))
  })

  it('falls back to no-ref when neither payment nor subscription id exist', () => {
    expect(buildAsaasDedupeKey({ event: 'PING' })).toBe('PING:no-ref')
  })
})
