'use server'

/**
 * Commission ("Reservas") report dataset.
 * Split out of actions/reports.ts.
 */

import { brl, dateOnly, relName, resolveSellerNames, type ReportCtx, type ReportResult } from './reports-shared'

export async function getCommissionReport(ctx: ReportCtx): Promise<ReportResult> {
  const { supabase, org, startISO, endISO, orgSlug, groupBy, base } = ctx

  // Commission is sourced from travel sales (commission_cents), grouped by the
  // seller who registered the sale (created_by). One row per seller with the
  // number of sales, gross sold value and total commission earned.
  const { data, error } = await supabase
    .from('travel_sales')
    .select('id, created_by, total_cents, commission_cents, created_at, operator, package_locator, client_name, contato_id, contato:contato_id(name)')
    .eq('organization_id', org.id)
    .gte('created_at', startISO)
    .lte('created_at', endISO)
    .order('created_at', { ascending: false })
  if (error) return { ok: false, error: 'query_error' }

  const sellerNames = await resolveSellerNames(
    (data || []).map((s: any) => s.created_by as string | null),
  )

  // Dimensão de agrupamento escolhida no "Organizar por" — vendedor
  // (padrão), operadora ou cliente. `groupKey`/`groupLabel` definem a
  // linha; `secondaryOf`/`secondaryLabel` definem a coluna de apoio
  // (o outro dado relevante dentro de cada grupo).
  const groupKey = (s: any): string => {
    if (groupBy === 'operator') return (s.operator as string) || '__none__'
    if (groupBy === 'client') return (s.contato_id as string) || (s.client_name ? `n:${s.client_name}` : '__none__')
    return (s.created_by as string | null) ?? '__none__'
  }
  const groupLabel = (key: string, s: any): string => {
    if (groupBy === 'operator') return key === '__none__' ? 'Sem operadora' : key
    if (groupBy === 'client') return relName(s.contato) || (s.client_name as string) || 'Sem cliente'
    return key === '__none__' ? 'Sem vendedor' : (sellerNames.get(key) || 'Sem vendedor')
  }
  const secondaryOf = (s: any): string | null => {
    if (groupBy === 'seller') return (s.operator as string) || null
    if (groupBy === 'operator') return (s.created_by && sellerNames.get(s.created_by as string)) || null
    return (s.operator as string) || null // client
  }
  const secondaryColumnLabel = groupBy === 'operator' ? 'Vendedor' : 'Operadora'
  const primaryColumnLabel = groupBy === 'operator' ? 'Operadora' : groupBy === 'client' ? 'Cliente' : 'Vendedor'
  const primaryTotalsUnit = groupBy === 'operator' ? 'operadora(s)' : groupBy === 'client' ? 'cliente(s)' : 'vendedor(es)'

  // Aggregate por grupo. `secondary` junta os valores distintos da outra
  // dimensão dentro do grupo — localizador não entra aqui, é por reserva
  // (fica na lista expandida abaixo).
  type Agg = { label: string; count: number; gross: number; commission: number; secondary: Set<string> }
  const byGroup = new Map<string, Agg>()
  for (const s of data || []) {
    const key = groupKey(s)
    const agg = byGroup.get(key) || { label: groupLabel(key, s), count: 0, gross: 0, commission: 0, secondary: new Set<string>() }
    const sec = secondaryOf(s)
    if (sec) agg.secondary.add(sec)
    agg.count += 1
    agg.gross += (s.total_cents as number) || 0
    agg.commission += (s.commission_cents as number) || 0
    byGroup.set(key, agg)
  }

  // Linha agrupada e linha de detalhe (venda individual) usam o MESMO
  // conjunto de colunas — só que cada uma preenche as que fazem sentido
  // pro seu nível: a agrupada soma/agrega (Vendas, Valor, Comissão, %),
  // a de detalhe mostra o que é único por venda e não agrega (Localizador,
  // Cliente, Data). Campo que não se aplica àquele nível fica em branco.
  const rows = Array.from(byGroup.values())
    .map(agg => ({
      seller: agg.label,
      locator: '',
      client: '',
      operators: agg.secondary.size > 0 ? Array.from(agg.secondary).join(', ') : '—',
      sale_date: '',
      count: agg.count,
      gross: brl(agg.gross),
      commission: brl(agg.commission),
      pct: agg.gross > 0 ? `${((agg.commission / agg.gross) * 100).toFixed(1)}%` : '—',
      _commission: agg.commission, // sort key, stripped before return
    }))
    .sort((a, b) => b._commission - a._commission)
    .map(({ _commission, ...row }) => row)

  const totalGross = (data || []).reduce((a: number, s: any) => a + ((s.total_cents as number) || 0), 0)
  const totalCommission = (data || []).reduce((a: number, s: any) => a + ((s.commission_cents as number) || 0), 0)

  // Vendas individuais por grupo, pra UI expandir cada linha agrupada —
  // mesmas chaves de `rows`, então a UI renderiza as duas com o mesmo
  // loop de colunas. `_saleId`/`_orgSlug` são só pro link "Abrir reserva".
  const salesByGroup = new Map<string, typeof data>()
  for (const s of data || []) {
    const key = groupKey(s)
    const arr = salesByGroup.get(key) || []
    arr.push(s)
    salesByGroup.set(key, arr)
  }
  const saleDetails = Array.from(salesByGroup.entries()).map(([key, sales]) => ({
    seller: groupLabel(key, (sales || [])[0]),
    sales: (sales || []).map((s: any) => ({
      seller: '',
      locator: (s.package_locator as string) || '—',
      client: relName((s as any).contato) || (s.client_name as string) || '—',
      operators: secondaryOf(s) || '—',
      sale_date: dateOnly(s.created_at as string),
      count: '',
      gross: brl(s.total_cents as number),
      commission: brl(s.commission_cents as number),
      pct: '',
      _saleId: s.id as string,
      _orgSlug: orgSlug,
    })),
  }))

  return {
    ok: true,
    data: {
      ...base,
      columns: [
        { key: 'seller', label: primaryColumnLabel },
        { key: 'locator', label: 'Localizador' },
        { key: 'client', label: 'Cliente' },
        { key: 'operators', label: secondaryColumnLabel },
        { key: 'sale_date', label: 'Data' },
        { key: 'count', label: 'Vendas', align: 'right' },
        { key: 'gross', label: 'Valor vendido', align: 'right' },
        { key: 'commission', label: 'Comissão', align: 'right' },
        { key: 'pct', label: '% Comissão', align: 'right' },
      ],
      rows,
      totals: {
        seller: `${rows.length} ${primaryTotalsUnit}`,
        count: String((data || []).length),
        gross: brl(totalGross),
        commission: brl(totalCommission),
        pct: totalGross > 0 ? `${((totalCommission / totalGross) * 100).toFixed(1)}%` : '—',
      },
      saleDetails,
    },
  }
}
