import { describe, it, expect } from 'vitest'
import { slugify } from '@/lib/utils/slugify'

describe('slugify', () => {
  it('lowercases and hyphenates simple text', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('strips accents (NFD normalization)', () => {
    expect(slugify('Olá Mundo')).toBe('ola-mundo')
    expect(slugify('Café com Leite')).toBe('cafe-com-leite')
  })

  it('removes punctuation and symbols', () => {
    expect(slugify('Hello, World!')).toBe('hello-world')
    expect(slugify('R$ 100 % off')).toBe('r-100-off')
  })

  it('collapses repeated whitespace and trims the ends', () => {
    expect(slugify('  Café   com   Leite  ')).toBe('cafe-com-leite')
  })

  it('returns an empty string for symbol-only input', () => {
    expect(slugify('@#$%')).toBe('')
  })
})
