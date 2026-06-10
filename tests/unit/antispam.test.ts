import { describe, it, expect } from 'vitest'
import { checkHoneypotAndTiming } from '@/lib/security/antispam'
import { MIN_FILL_TIME_MS } from '@/lib/security/antispam-constants'

describe('checkHoneypotAndTiming', () => {
  it('passes when honeypot is empty and no timestamp is given', () => {
    expect(checkHoneypotAndTiming('', null)).toEqual({ ok: true })
    expect(checkHoneypotAndTiming(null, undefined)).toEqual({ ok: true })
    expect(checkHoneypotAndTiming(undefined, undefined)).toEqual({ ok: true })
  })

  it('blocks when the honeypot field is filled', () => {
    expect(checkHoneypotAndTiming('a bot wrote here', null)).toEqual({
      ok: false,
      reason: 'honeypot',
    })
  })

  it('treats a whitespace-only honeypot as empty (passes)', () => {
    expect(checkHoneypotAndTiming('   ', null)).toEqual({ ok: true })
  })

  it('blocks a submission that is suspiciously fast', () => {
    const justNow = Date.now() - 200 // 200ms after mount → well under the floor
    expect(checkHoneypotAndTiming('', justNow)).toEqual({ ok: false, reason: 'too_fast' })
  })

  it('passes a submission that took longer than the minimum fill time', () => {
    const mounted = Date.now() - (MIN_FILL_TIME_MS + 1000)
    expect(checkHoneypotAndTiming('', mounted)).toEqual({ ok: true })
  })

  it('accepts a string timestamp (parsed as an integer)', () => {
    const mounted = String(Date.now() - (MIN_FILL_TIME_MS + 1000))
    expect(checkHoneypotAndTiming('', mounted)).toEqual({ ok: true })
  })

  it('blocks a timestamp set in the future (tampered)', () => {
    const future = Date.now() + 60_000
    // A future mount makes elapsed negative → first the <MIN_FILL_TIME check
    // catches it as too_fast (negative is also < the floor).
    expect(checkHoneypotAndTiming('', future)).toEqual({ ok: false, reason: 'too_fast' })
  })

  it('blocks an absurdly old timestamp (>7 days → tampered)', () => {
    const ancient = Date.now() - 8 * 24 * 60 * 60 * 1000
    expect(checkHoneypotAndTiming('', ancient)).toEqual({
      ok: false,
      reason: 'tampered_timestamp',
    })
  })

  it('ignores a non-numeric / zero timestamp and passes', () => {
    expect(checkHoneypotAndTiming('', 'not-a-number')).toEqual({ ok: true })
    expect(checkHoneypotAndTiming('', 0)).toEqual({ ok: true })
  })
})
