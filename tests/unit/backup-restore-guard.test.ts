import { describe, it, expect } from 'vitest'
import { canRestore } from '@/lib/backup/restore-object'

describe('canRestore', () => {
  it('allows restoring a deleted object without confirmation', () => {
    expect(canRestore('deleted', false)).toBe(true)
  })

  it('allows restoring a missing object without confirmation', () => {
    expect(canRestore('missing', false)).toBe(true)
  })

  it('blocks restoring an active object without explicit overwrite', () => {
    expect(canRestore('active', false)).toBe(false)
  })

  it('allows restoring an active object with explicit overwrite', () => {
    expect(canRestore('active', true)).toBe(true)
  })
})
