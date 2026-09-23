import { describe, it, expect } from 'vitest'
import { deriveInitials } from '@/lib/organization/initials'

describe('deriveInitials', () => {
  it('uses first+last word initials for multi-word names', () => {
    expect(deriveInitials('Viagens Horizonte')).toBe('VH')
  })

  it('uses first two letters for single-word names', () => {
    expect(deriveInitials('Althos')).toBe('AL')
  })

  it('collapses extra whitespace', () => {
    expect(deriveInitials('  Agência   Sul  ')).toBe('AS')
  })

  it('falls back to "?" for an empty name', () => {
    expect(deriveInitials('')).toBe('?')
    expect(deriveInitials('   ')).toBe('?')
  })

  it('handles three or more words by using only first and last', () => {
    expect(deriveInitials('Viagens Cinco Estrelas')).toBe('VE')
  })
})
