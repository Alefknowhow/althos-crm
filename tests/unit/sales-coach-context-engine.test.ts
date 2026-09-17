import { describe, it, expect, vi } from 'vitest'
import { updateSalesContext } from '@/lib/sales-coach/context-engine'
import { emptySalesContext } from '@/lib/sales-coach/types'

function fakeClient(toolInput: Record<string, unknown>) {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'tool_use', name: 'update_sales_context', input: toolInput }],
      }),
    },
  } as unknown as import('@anthropic-ai/sdk').default
}

describe('updateSalesContext', () => {
  it('retorna o contexto anterior sem chamar o modelo quando não há segmentos novos', async () => {
    const client = fakeClient({})
    const previous = emptySalesContext()

    const result = await updateSalesContext({ previousContext: previous, newSegments: [], client })

    expect(result).toBe(previous)
    expect((client.messages.create as any)).not.toHaveBeenCalled()
  })

  it('mescla o retorno do modelo sobre o contexto anterior', async () => {
    const previous = { ...emptySalesContext(), pains: ['demora no atendimento'] }
    const client = fakeClient({
      ...emptySalesContext(),
      pains: ['demora no atendimento', 'leads esquecidos'],
      budget: 'R$ 2.000/mês',
    })

    const result = await updateSalesContext({
      previousContext: previous,
      newSegments: [{ speaker: 'cliente', text: 'a gente também perde muito lead esquecido' }],
      client,
    })

    expect(result.pains).toEqual(['demora no atendimento', 'leads esquecidos'])
    expect(result.budget).toBe('R$ 2.000/mês')
  })

  it('devolve o contexto anterior se o modelo não chamar a tool', async () => {
    const previous = { ...emptySalesContext(), pains: ['x'] }
    const client = {
      messages: { create: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'desculpe' }] }) },
    } as unknown as import('@anthropic-ai/sdk').default

    const result = await updateSalesContext({
      previousContext: previous,
      newSegments: [{ text: 'oi' }],
      client,
    })

    expect(result).toBe(previous)
  })
})
