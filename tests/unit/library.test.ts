import { describe, it, expect } from 'vitest'
import { libraryItemsToKnowledgeBase, type LibraryItem } from '@/lib/ai/library'

function item(overrides: Partial<LibraryItem> = {}): LibraryItem {
  return {
    id: 'item-1',
    organization_id: 'org-1',
    source_module: 'library',
    category: null,
    title: 'Horário de atendimento',
    content: 'Seg a sex, 9h às 18h.',
    priority: 0,
    is_active: true,
    ...overrides,
  }
}

describe('libraryItemsToKnowledgeBase', () => {
  it('maps title/content to question/answer, preserving category', () => {
    const [kb] = libraryItemsToKnowledgeBase([item({ category: 'Institucional' })])
    expect(kb).toEqual({ category: 'Institucional', question: 'Horário de atendimento', answer: 'Seg a sex, 9h às 18h.' })
  })

  it('returns an empty array for an empty library, never throws', () => {
    expect(libraryItemsToKnowledgeBase([])).toEqual([])
  })

  it('preserves order (priority ordering is the caller/query responsibility)', () => {
    const items = [item({ id: 'a', title: 'A' }), item({ id: 'b', title: 'B' })]
    const kb = libraryItemsToKnowledgeBase(items)
    expect(kb.map(k => k.question)).toEqual(['A', 'B'])
  })
})
