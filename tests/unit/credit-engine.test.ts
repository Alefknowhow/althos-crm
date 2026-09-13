import { describe, it, expect } from 'vitest'
import { buildCreditIdempotencyKey } from '@/lib/credits/engine'

describe('buildCreditIdempotencyKey', () => {
  it('is deterministic for the same inputs (same event -> same key on retry)', () => {
    const k1 = buildCreditIdempotencyKey('ai_attendant', 'ai_attendant_reply', 'evt_123')
    const k2 = buildCreditIdempotencyKey('ai_attendant', 'ai_attendant_reply', 'evt_123')
    expect(k1).toBe(k2)
  })

  it('differs when module, action, or reference differ', () => {
    const base = buildCreditIdempotencyKey('ai_attendant', 'ai_attendant_reply', 'evt_123')
    expect(buildCreditIdempotencyKey('lead_scoring', 'ai_attendant_reply', 'evt_123')).not.toBe(base)
    expect(buildCreditIdempotencyKey('ai_attendant', 'lead_scoring', 'evt_123')).not.toBe(base)
    expect(buildCreditIdempotencyKey('ai_attendant', 'ai_attendant_reply', 'evt_456')).not.toBe(base)
  })

  it('encodes module:action:ref in order (readable in the ledger for debugging)', () => {
    expect(buildCreditIdempotencyKey('qualifier', 'qualify_lead', 'lead-abc')).toBe('qualifier:qualify_lead:lead-abc')
  })
})
