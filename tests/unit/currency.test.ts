import { describe, it, expect } from 'vitest'
import { formatCurrency, parseCurrency, slugify } from '@/lib/utils'

describe('formatCurrency', () => {
  it('formats integer cents as a BRL string', () => {
    const s = formatCurrency(13700)
    expect(s).toContain('R$')
    expect(s).toContain('137')
    expect(s).toContain('00')
  })

  it('formats zero', () => {
    const s = formatCurrency(0)
    expect(s).toContain('R$')
    expect(s).toContain('0')
  })

  it('handles a value with non-zero cents', () => {
    const s = formatCurrency(12345) // R$ 123,45
    expect(s).toContain('123')
    expect(s).toContain('45')
  })
})

describe('parseCurrency', () => {
  it('strips non-digits and returns an integer (cents)', () => {
    expect(parseCurrency('R$ 137,00')).toBe(13700)
    expect(parseCurrency('1.234,56')).toBe(123456)
  })

  it('returns 0 for input with no digits', () => {
    expect(parseCurrency('abc')).toBe(0)
    expect(parseCurrency('')).toBe(0)
  })
})

describe('slugify (utils.ts variant)', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('collapses repeated hyphens', () => {
    expect(slugify('a - b')).toBe('a-b')
  })

  it('removes non-word characters', () => {
    expect(slugify('Hello, World!')).toBe('hello-world')
  })
})
