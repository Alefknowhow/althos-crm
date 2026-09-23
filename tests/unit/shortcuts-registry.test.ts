import { describe, it, expect } from 'vitest'
import { comboFromEvent } from '@/lib/shortcuts/registry'

function ev(partial: Partial<Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>>) {
  return { key: '', metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...partial }
}

describe('comboFromEvent', () => {
  it('Cmd/Ctrl+K normalizes to "mod+k"', () => {
    expect(comboFromEvent(ev({ key: 'k', metaKey: true }))).toBe('mod+k')
    expect(comboFromEvent(ev({ key: 'k', ctrlKey: true }))).toBe('mod+k')
  })

  it('Shift+/ (produces "?") normalizes to bare "?", not "shift+?"', () => {
    expect(comboFromEvent(ev({ key: '?', shiftKey: true }))).toBe('?')
  })

  it('plain "/" (no shift) stays "/"', () => {
    expect(comboFromEvent(ev({ key: '/' }))).toBe('/')
  })

  it('Shift+K (a letter) keeps the shift modifier, since case is lowercased away', () => {
    expect(comboFromEvent(ev({ key: 'K', shiftKey: true }))).toBe('shift+k')
  })

  it('plain lowercase letter has no shift modifier', () => {
    expect(comboFromEvent(ev({ key: 'k' }))).toBe('k')
  })

  it('non-printable keys keep their DOM key value', () => {
    expect(comboFromEvent(ev({ key: 'Escape' }))).toBe('Escape')
    expect(comboFromEvent(ev({ key: 'ArrowDown' }))).toBe('ArrowDown')
  })

  it('a bare modifier keydown does not append itself as the key', () => {
    expect(comboFromEvent(ev({ key: 'Shift', shiftKey: true }))).toBe('')
  })
})

