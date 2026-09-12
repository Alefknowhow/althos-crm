import { describe, it, expect } from 'vitest'
import { toDigits, normalizePhoneE164BR, formatPhoneDisplay } from '@/lib/phone'

describe('toDigits', () => {
  it('strips everything but digits', () => {
    expect(toDigits('+55 (47) 99999-9999')).toBe('5547999999999')
  })

  it('returns empty string for null/undefined', () => {
    expect(toDigits(null)).toBe('')
    expect(toDigits(undefined)).toBe('')
  })
})

describe('normalizePhoneE164BR', () => {
  it('prefixes 55 when the number has no country code (10-11 digits)', () => {
    expect(normalizePhoneE164BR('(47) 99999-9999')).toBe('5547999999999')
    expect(normalizePhoneE164BR('4732221100')).toBe('554732221100')
  })

  it('leaves a number that already has 12+ digits untouched', () => {
    expect(normalizePhoneE164BR('+55 47 99999-9999')).toBe('5547999999999')
  })

  it('returns undefined for empty input', () => {
    expect(normalizePhoneE164BR(null)).toBeUndefined()
    expect(normalizePhoneE164BR('')).toBeUndefined()
  })
})

describe('formatPhoneDisplay', () => {
  it('formats an 11-digit number (with 9th digit) without country code', () => {
    expect(formatPhoneDisplay('47999999999')).toBe('+55 (47) 99999 9999')
  })

  it('formats a 13-digit number already carrying the 55 country code', () => {
    expect(formatPhoneDisplay('5547999999999')).toBe('+55 (47) 99999 9999')
  })

  it('formats a 10-digit landline number (no 9th digit)', () => {
    expect(formatPhoneDisplay('4732221100')).toBe('+55 (47) 3222 1100')
  })

  it('returns the original value unchanged for an unrecognizable format', () => {
    expect(formatPhoneDisplay('123')).toBe('123')
  })

  it('returns empty string for null/undefined', () => {
    expect(formatPhoneDisplay(null)).toBe('')
    expect(formatPhoneDisplay(undefined)).toBe('')
  })
})
