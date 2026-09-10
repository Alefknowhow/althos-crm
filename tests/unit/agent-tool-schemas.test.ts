import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: vi.fn(), createClient: vi.fn() }))
vi.mock('@/lib/agent/context', () => ({ agentCanAccess: () => false }))
import { define, date, money, record } from '@/lib/agent/tools/crm-shared'
import { summarizeFinance } from '@/lib/agent/tools/dashboards'
import { createAdminClient } from '@/lib/supabase/server'

describe('MCP validation and metric semantics', () => {
  it.each(['contatos', 'pipeline_stages'])('scopes %s IDs to the authenticated organization', async table => {
    const query: any = { select: vi.fn(), eq: vi.fn(), single: vi.fn().mockResolvedValue({ data: null, error: null }) }
    query.select.mockReturnValue(query); query.eq.mockReturnValue(query)
    vi.mocked(createAdminClient).mockReturnValue({ from: () => query } as any)
    await expect(record({ orgId: 'own-org' } as any, table, 'foreign-record')).rejects.toThrow('não encontrado')
    expect(query.eq).toHaveBeenCalledWith(table === 'pipeline_stages' ? 'pipelines.organization_id' : 'organization_id', 'own-org')
  })
  it('rejects fake approval and arbitrary organization fields', async () => {
    const handler = vi.fn()
    const { tool } = define('update_test', '', 'clients', { id: z.string() }, 'change', handler)
    await expect(tool.handler({} as any, { id: '1', approved: true, organization_id: 'other' })).rejects.toThrow()
    expect(handler).not.toHaveBeenCalled()
  })
  it('requires real dates and integer cents within database range', () => {
    expect(date.safeParse('2026-02-30').success).toBe(false)
    expect(money.safeParse(1.5).success).toBe(false)
    expect(money.safeParse(2147483648).success).toBe(false)
    expect(money.safeParse(12345).success).toBe(true)
  })
  it('sums canceled, unpaid and paid financial entries correctly', () => {
    const result = summarizeFinance([
      { tipo: 'receita', categoria: 'Vendas', valor_cents: 10000, status: 'pago' },
      { tipo: 'receita', categoria: 'Vendas', valor_cents: 5000, status: 'pendente' },
      { tipo: 'receita', categoria: 'Vendas', valor_cents: 900000, status: 'cancelado' },
      { tipo: 'despesa', categoria: 'Custos', valor_cents: 2000, status: 'pago' },
    ])
    expect(result).toMatchObject({ receita_cents: 15000, despesa_cents: 2000, resultado_cents: 13000, recebidos_cents: 10000, pagos_cents: 2000, entries: 3 })
  })
  it('does not let category names mutate object prototypes', () => {
    const result = summarizeFinance([{ tipo: 'receita', categoria: '__proto__', valor_cents: 100, status: 'pago' }])
    expect(result.categories.__proto__.receita_cents).toBe(100)
    expect(Object.getPrototypeOf(result.categories)).toBeNull()
  })
})
