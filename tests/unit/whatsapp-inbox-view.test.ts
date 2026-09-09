import { describe, expect, it } from 'vitest'
import { matchesInboxView } from '@/lib/whatsapp/inbox-view'

describe('visualizações da barra do WhatsApp', () => {
  it('separa arquivadas da caixa de entrada', () => {
    const archived = { id: '1', archived: true, unread_count: 2, pinned: true }
    expect(matchesInboxView(archived, 'all')).toBe(false)
    expect(matchesInboxView(archived, 'unread')).toBe(false)
    expect(matchesInboxView(archived, 'pinned')).toBe(false)
    expect(matchesInboxView(archived, 'archived')).toBe(true)
    expect(matchesInboxView({ id: '2' }, 'archived')).toBe(false)
  })
  it('filtra não lidas e fixadas', () => {
    expect(matchesInboxView({ id: '1', unread_count: 0 }, 'unread')).toBe(false)
    expect(matchesInboxView({ id: '1', unread_count: 1 }, 'unread')).toBe(true)
    expect(matchesInboxView({ id: '1', pinned: true }, 'pinned')).toBe(true)
    expect(matchesInboxView({ id: '1' }, 'pinned')).toBe(false)
  })
  it('preserva a conversa aberta após leitura ou arquivamento', () => {
    expect(matchesInboxView({ id: '1', unread_count: 0 }, 'unread', '1')).toBe(true)
    expect(matchesInboxView({ id: '1', archived: true }, 'all', '1')).toBe(true)
  })
})
