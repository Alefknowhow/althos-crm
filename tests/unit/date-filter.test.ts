import { describe, it, expect } from 'vitest'
import { matchesDateBucket } from '@/lib/utils/date-filter'

// Build an ISO string relative to "now" so the suite is time-independent.
function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString()
}

describe('matchesDateBucket', () => {
  it('the "all" bucket always matches, even for null/garbage input', () => {
    expect(matchesDateBucket(null, 'all')).toBe(true)
    expect(matchesDateBucket(undefined, 'all')).toBe(true)
    expect(matchesDateBucket('not-a-date', 'all')).toBe(true)
  })

  it('returns false for null/empty input on a concrete bucket', () => {
    expect(matchesDateBucket(null, 'today')).toBe(false)
    expect(matchesDateBucket(undefined, 'this_month')).toBe(false)
    expect(matchesDateBucket('', 'year')).toBe(false)
  })

  it('returns false for an unparseable date string', () => {
    expect(matchesDateBucket('totally-bogus', 'today')).toBe(false)
  })

  it('matches today for a timestamp from right now', () => {
    expect(matchesDateBucket(new Date().toISOString(), 'today')).toBe(true)
  })

  it('does not match today for a timestamp from a week ago', () => {
    expect(matchesDateBucket(isoDaysFromNow(-7), 'today')).toBe(false)
  })

  it('matches the current year but not a far-future year', () => {
    expect(matchesDateBucket(new Date().toISOString(), 'year')).toBe(true)
    expect(matchesDateBucket(isoDaysFromNow(800), 'year')).toBe(false)
  })

  it('matches this_month for now but not for ~60 days out', () => {
    expect(matchesDateBucket(new Date().toISOString(), 'this_month')).toBe(true)
    expect(matchesDateBucket(isoDaysFromNow(60), 'this_month')).toBe(false)
  })
})
