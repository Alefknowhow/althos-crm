import { describe, it, expect } from 'vitest'

function fakeSupabase(dataByTable: Record<string, any>) {
  return {
    from: (table: string) => {
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: dataByTable[table] ?? null }),
      }
      return chain
    },
  }
}

describe('resolveMergeFields — reserva', () => {
  it('formats date/currency and falls back to empty strings for missing data', async () => {
    const supabase = fakeSupabase({
      organizations: { name: 'Viagens Cinco Estrelas', cnpj: '00.000.000/0001-00', cadastur: null, contact_phone: null, contact_email: null, address_street: null },
      travel_sales: { client_name: 'Maria', destination: 'Lisboa', hotel_name: null, departure_date: '2026-10-01', return_date: '2026-10-10', total_cents: 500000, payment_method: 'pix', operator: 'CVC', airline: null, package_locator: null, air_locator: null, cancellation_policy: null, important_info: null, service_info: null, notes: null },
    })

    const { resolveMergeFields } = await import('@/lib/contracts/merge-fields')
    const result = await resolveMergeFields(supabase as any, 'org-1', 'reserva', 'sale-1')

    expect(result.org.nome).toBe('Viagens Cinco Estrelas')
    expect(result.sale.cliente).toBe('Maria')
    expect(result.sale.destino).toBe('Lisboa')
    expect(result.sale.valor_total).toContain('5.000,00')
    expect(result.sale.hotel).toBe('')
  })

  it('returns empty sale fields when the entity is not found, never throws', async () => {
    const supabase = fakeSupabase({})
    const { resolveMergeFields } = await import('@/lib/contracts/merge-fields')
    const result = await resolveMergeFields(supabase as any, 'org-1', 'reserva', 'missing')
    expect(result.sale).toEqual({})
  })
})
