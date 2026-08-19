import { describe, it, expect } from 'vitest'
import { tiersForDate, isExpired, extractDateFromKey, RETENTION_DAYS } from '@/lib/backup/retention'

describe('tiersForDate', () => {
  it('always includes daily', () => {
    expect(tiersForDate(new Date('2026-08-19T00:00:00Z'))).toContain('daily') // wednesday
  })

  it('includes weekly on sundays', () => {
    expect(tiersForDate(new Date('2026-08-23T00:00:00Z'))).toEqual(expect.arrayContaining(['daily', 'weekly']))
    expect(tiersForDate(new Date('2026-08-19T00:00:00Z'))).not.toContain('weekly')
  })

  it('includes monthly on the 1st', () => {
    expect(tiersForDate(new Date('2026-09-01T00:00:00Z'))).toEqual(expect.arrayContaining(['daily', 'monthly']))
    expect(tiersForDate(new Date('2026-09-02T00:00:00Z'))).not.toContain('monthly')
  })
})

describe('isExpired', () => {
  it('is not expired within the retention window', () => {
    const createdAt = new Date('2026-08-18T00:00:00Z')
    const now = new Date('2026-08-19T00:00:00Z')
    expect(isExpired(createdAt, 'daily', now)).toBe(false)
  })

  it('is expired past the retention window', () => {
    const createdAt = new Date('2026-01-01T00:00:00Z')
    const now = new Date('2026-08-19T00:00:00Z')
    expect(isExpired(createdAt, 'daily', now)).toBe(true)
  })

  it('respects different windows per tier — same age, different outcome', () => {
    const createdAt = new Date('2026-07-01T00:00:00Z') // ~49 dias antes de now
    const now = new Date('2026-08-19T00:00:00Z')
    expect(isExpired(createdAt, 'daily', now)).toBe(true) // > 30 dias
    expect(isExpired(createdAt, 'monthly', now)).toBe(false) // < 360 dias
  })

  it('RETENTION_DAYS matches the documented policy', () => {
    expect(RETENTION_DAYS.daily).toBe(30)
    expect(RETENTION_DAYS.weekly).toBe(84)
    expect(RETENTION_DAYS.monthly).toBe(360)
  })
})

describe('extractDateFromKey', () => {
  it('extracts the date from a database backup key', () => {
    const d = extractDateFromKey('database/daily/2026-08-19.enc')
    expect(d?.toISOString().slice(0, 10)).toBe('2026-08-19')
  })

  it('extracts the date from a manifest key', () => {
    const d = extractDateFromKey('manifests/weekly/database-2026-08-17.json')
    expect(d?.toISOString().slice(0, 10)).toBe('2026-08-17')
  })

  it('returns null when there is no date — never guess, never delete blindly', () => {
    expect(extractDateFromKey('database/daily/no-date-here.enc')).toBeNull()
  })
})
