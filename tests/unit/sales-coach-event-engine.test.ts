import { describe, it, expect, vi } from 'vitest'
import { extractSalesEvents, dedupeEvents } from '@/lib/sales-coach/event-engine'
import { emptySalesContext } from '@/lib/sales-coach/types'
import type { SalesEvent } from '@/lib/sales-coach/types'

function fakeClient(events: SalesEvent[]) {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'tool_use', name: 'extract_sales_events', input: { events } }],
      }),
    },
  } as unknown as import('@anthropic-ai/sdk').default
}

describe('dedupeEvents', () => {
  it('remove eventos com o mesmo tipo e resumo similar a um já existente', () => {
    const existing: SalesEvent[] = [
      { type: 'OBJECTION_DETECTED', summary: 'Cliente achou o preço acima do esperado', confidence: 0.9, importance: 0.8, suggestion: null },
    ]
    const candidates: SalesEvent[] = [
      { type: 'OBJECTION_DETECTED', summary: 'Cliente disse que o preço ficou acima do esperado', confidence: 0.85, importance: 0.7, suggestion: null },
      { type: 'BUYING_SIGNAL', summary: 'Perguntou sobre prazo de implantação', confidence: 0.7, importance: 0.6, suggestion: null },
    ]

    const result = dedupeEvents(existing, candidates)

    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('BUYING_SIGNAL')
  })

  it('mantém eventos do mesmo tipo quando o conteúdo é claramente diferente', () => {
    const existing: SalesEvent[] = [
      { type: 'OBJECTION_DETECTED', summary: 'Cliente achou o preço caro', confidence: 0.9, importance: 0.8, suggestion: null },
    ]
    const candidates: SalesEvent[] = [
      { type: 'OBJECTION_DETECTED', summary: 'Cliente precisa falar com o sócio antes de decidir', confidence: 0.8, importance: 0.7, suggestion: null },
    ]

    const result = dedupeEvents(existing, candidates)

    expect(result).toHaveLength(1)
  })
})

describe('extractSalesEvents', () => {
  it('retorna lista vazia sem chamar o modelo quando não há segmentos novos', async () => {
    const client = fakeClient([])
    const result = await extractSalesEvents({
      context: emptySalesContext(),
      newSegments: [],
      existingEvents: [],
      client,
    })
    expect(result).toEqual([])
    expect((client.messages.create as any)).not.toHaveBeenCalled()
  })

  it('filtra eventos duplicados contra os já existentes', async () => {
    const existing: SalesEvent[] = [
      { type: 'PAIN_DETECTED', summary: 'Demora no atendimento gera perda de lead', confidence: 0.9, importance: 0.8, suggestion: null },
    ]
    const client = fakeClient([
      { type: 'PAIN_DETECTED', summary: 'Demora no atendimento faz perder lead', confidence: 0.88, importance: 0.75, suggestion: null },
      { type: 'COMPETITOR_MENTIONED', summary: 'Cliente mencionou usar Kommo hoje', confidence: 0.95, importance: 0.6, suggestion: null },
    ])

    const result = await extractSalesEvents({
      context: emptySalesContext(),
      newSegments: [{ speaker: 'cliente', text: 'hoje usamos o Kommo' }],
      existingEvents: existing,
      client,
    })

    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('COMPETITOR_MENTIONED')
  })
})
