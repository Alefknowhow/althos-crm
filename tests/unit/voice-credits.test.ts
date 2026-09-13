import { describe, it, expect } from 'vitest'
import { buildVoiceIdempotencyKey } from '@/lib/voice/credits'

describe('buildVoiceIdempotencyKey', () => {
  it('is deterministic for the same usage type + reference (retry -> same key)', () => {
    const k1 = buildVoiceIdempotencyKey('call_human', 'reserve:call-123')
    const k2 = buildVoiceIdempotencyKey('call_human', 'reserve:call-123')
    expect(k1).toBe(k2)
  })

  it('differs when usage type or reference differ', () => {
    const base = buildVoiceIdempotencyKey('call_human', 'reserve:call-123')
    expect(buildVoiceIdempotencyKey('sms', 'reserve:call-123')).not.toBe(base)
    expect(buildVoiceIdempotencyKey('call_human', 'reserve:call-456')).not.toBe(base)
  })

  it('namespaces under voice: so it never collides with Althos Credits (IA) idempotency keys', () => {
    expect(buildVoiceIdempotencyKey('sms', 'evt-1')).toBe('voice:sms:evt-1')
  })
})
