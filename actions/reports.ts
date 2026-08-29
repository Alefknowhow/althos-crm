'use server'

/**
 * Report datasets for PDF/Excel export. Gated by the `export_reports` feature
 * (Business plan; super-admins bypass in SQL). Each report returns a uniform
 * tabular shape so the same data drives both the CSV export and the printable
 * PDF view.
 *
 * Reads are RLS-scoped (members only see their own org). Seller names are the
 * one exception: they live in auth, so we resolve them best-effort with the
 * admin client for the sales report.
 */

import { createClient } from '@/lib/supabase/server'
import { getProfilesMap } from '@/lib/profiles'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkFeatureAccessByOrgSlug } from '@/lib/plans/server'
import { isTravelNiche } from '@/lib/niche'

export type ReportType = 'leads' | 'sales' | 'appointments' | 'commission' | 'imoveis'

/** Só usado pelo relatório de Comissões — dimensão de agrupamento das linhas. */
export type CommissionGroupBy = 'seller' | 'operator' | 'client'

export interface ReportColumn {
  key: string
  label: string
  /** Right-align numeric/currency columns in the print view. */
  align?: 'left' | 'right'
}

export interface ReportData {
  type: ReportType
  title: string
  orgName: string
  generatedAt: string
  periodLabel: string
  from: string
  to: string
  columns: ReportColumn[]
  rows: Record<string, string | number>[]
  /** Optional summary line (e.g. totals) rendered below the table. */
  totals?: Record<string, string | number>
  /**
   * Só no relatório de Reservas (Comissões): cada linha agrupada (rows[i])
   * tem as vendas individuais que a compõem, pra UI expandir inline. Cada
   * venda usa as MESMAS chaves de `rows` (mesmas `columns`), só que
   * preenchidas do lado do detalhe (Localizador/Cliente/Data) em vez do
   * lado agrupado (Vendas/Valor total/Comissão total/%) — `_saleId`/
   * `_orgSlug` são só pro link "Abrir reserva", não entram em `columns`.
   * CSV/PDF continuam usando só `columns`/`rows` (agrupado).
   */
  saleDetails?: { seller: string; sales: (Record<string, string | number> & { _saleId: string; _orgSlug: string })[] }[]
}

export type ReportResult =
  | { ok: true; data: ReportData }
  | { ok: false; error: string }

const TITLES: Record<ReportType, string> = {
  leads: 'Relatório de Leads',
  sales: 'Relatório de Vendas',
  appointments: 'Relatório de Agendamentos',
  commission: 'Relatório de Reservas',
  imoveis: 'Relatório de Imóveis',
}

function brl(cents: number | null | undefined): string {
  return ((cents ?? 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function dt(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
  })
}

function dateOnly(d: string | null | undefined): string {
  if (!d) return '—'
  // sale_date is a plain date; render without TZ shifting.
  const [y, m, day] = d.slice(0, 10).split('-')
  return `${day}/${m}/${y}`
}

function relName(rel: unknown): string | null {
  if (!rel) return null
  const r = Array.isArray(rel) ? rel[0] : rel
  return (r as any)?.name ?? null
}

const SALES_STATUS_PT: Record<string, string> = {
  completed: 'Concluída', pending: 'Pendente', canceled: 'Cancelada', refunded: 'Estornada',
}
const APPT_STATUS_PT: Record<string, string> = {
  scheduled: 'Agendado', completed: 'Realizado', canceled: 'Cancelado', no_show: 'Não compareceu',
}

/**
 * Build a report dataset. `from`/`to` are YYYY-MM-DD (inclusive). Returns
 * `{ ok:false, error:'forbidden' }` when the account lacks the feature.
 */
export async function getReport(
  orgSlug: string,
  type: ReportType,
  from: string,
  to: string,
  groupBy: CommissionGroupBy = 'seller',
): Promise<ReportResult> {
  await requireAuth()

  if (!isYmd(from) || !isYmd(to)) return { ok: false, error: 'invalid_period' }
  if (!TITLES[type]) return { ok: false, error: 'invalid_type' }

  const allowed = await checkFeatureAccessByOrgSlug(orgSlug, 'export_reports')
  if (!allowed) return { ok: false, error: 'forbidden' }

  const org = await getCurrentOrganization(orgSlug) as any
  const supabase = createClient()

  // Inclusive day boundaries in São Paulo time → UTC ISO for timestamptz cols.
  const startISO = `${from}T00:00:00-03:00`
  const endISO = `${to}T23:59:59-03:00`
  const periodLabel = `${dateOnly(from)} a ${dateOnly(to)}`

  const base: Omit<ReportData, 'columns' | 'rows' | 'totals'> = {
    type,
    title: TITLES[type],
    orgName: org.name,
    generatedAt: new Date().toISOString(),
    periodLabel,
    from,
    to,
  }

  if (type === 'leads') {
    const { data, error } = await supabase
      .from('contatos')
      .select('name, email, phone, source, value_cents, created_at, stage:stage_id(name)')
      .eq('organization_id', org.id)
      .gte('created_at', startISO)
      .lte('created_at', endISO)
      .order('created_at', { ascending: false })
    if (error) return { ok: false, error: 'query_error' }

    const rows = (data || []).map(l => ({
      created_at: dt(l.created_at as string),
      name: (l.name as string) || '—',
      email: (l.email as string) || '—',
      phone: (l.phone as string) || '—',
      source: (l.source as string) || '—',
      stage: relName((l as any).stage) || '—',
      value: brl(l.value_cents as number),
    }))
    const totalValue = (data || []).reduce((a, l) => a + ((l.value_cents as number) || 0), 0)

    return {
      ok: true,
      data: {
        ...base,
        columns: [
          { key: 'created_at', label: 'Criado em' },
          { key: 'name', label: 'Nome' },
          { key: 'email', label: 'E-mail' },
          { key: 'phone', label: 'Telefone' },
          { key: 'source', label: 'Origem' },
          { key: 'stage', label: 'Etapa' },
          { key: 'value', label: 'Valor', align: 'right' },
        ],
        rows,
        totals: { name: `${rows.length} lead(s)`, value: brl(totalValue) },
      },
    }
  }

  if (type === 'sales') {
    // Agências de viagem registram venda em travel_sales (reservas), não na
    // tabela genérica `sales` — mesma fonte já usada pelo relatório de
    // comissão (ver bloco `commission` abaixo) e pelo dashboard
    // (lib/dashboard/sales-source.ts). Sem isso, orgs desse nicho sempre
    // veem o relatório de vendas vazio.
    if (isTravelNiche(org.niche)) {
      const { data, error } = await supabase
        .from('travel_sales')
        .select('created_at, destination, total_cents, payment_method, operator, package_locator, commission_cents, created_by, contato:contato_id(name)')
        .eq('organization_id', org.id)
        .gte('created_at', startISO)
        .lte('created_at', endISO)
        .order('created_at', { ascending: false })
      if (error) return { ok: false, error: 'query_error' }

      const sellerNames = await resolveSellerNames(
        (data || []).map(s => s.created_by as string | null),
      )

      const rows = (data || []).map(s => ({
        sale_date: dateOnly(s.created_at as string),
        lead: relName((s as any).contato) || (s.destination as string) || '—',
        destination: (s.destination as string) || '—',
        seller: (s.created_by && sellerNames.get(s.created_by as string)) || '—',
        payment_method: (s.payment_method as string) || '—',
        operator: (s.operator as string) || '—',
        package_locator: (s.package_locator as string) || '—',
        commission: brl(s.commission_cents as number),
        amount: brl(s.total_cents as number),
      }))
      const totalValue = (data || []).reduce((a, s) => a + ((s.total_cents as number) || 0), 0)

      return {
        ok: true,
        data: {
          ...base,
          columns: [
            { key: 'sale_date', label: 'Data' },
            { key: 'lead', label: 'Cliente' },
            { key: 'destination', label: 'Destino' },
            { key: 'seller', label: 'Vendedor' },
            { key: 'payment_method', label: 'Pagamento' },
            { key: 'operator', label: 'Operadora' },
            { key: 'package_locator', label: 'Localizador operadora' },
            { key: 'commission', label: 'Comissão', align: 'right' },
            { key: 'amount', label: 'Valor', align: 'right' },
          ],
          rows,
          totals: { lead: `${rows.length} reserva(s)`, amount: brl(totalValue) },
        },
      }
    }

    const { data, error } = await supabase
      .from('sales')
      .select('sale_date, amount_cents, quantity, payment_method, installments, status, seller_id, lead:contato_id(name)')
      .eq('organization_id', org.id)
      .gte('sale_date', from)
      .lte('sale_date', to)
      .order('sale_date', { ascending: false })
    if (error) return { ok: false, error: 'query_error' }

    const sellerNames = await resolveSellerNames(
      (data || []).map(s => s.seller_id as string | null),
    )

    const rows = (data || []).map(s => ({
      sale_date: dateOnly(s.sale_date as string),
      lead: relName((s as any).lead) || '—',
      seller: (s.seller_id && sellerNames.get(s.seller_id as string)) || '—',
      quantity: (s.quantity as number) ?? 1,
      payment_method: (s.payment_method as string) || '—',
      installments: (s.installments as number) ?? 1,
      status: SALES_STATUS_PT[s.status as string] || (s.status as string) || '—',
      amount: brl(s.amount_cents as number),
    }))
    const totalValue = (data || []).reduce((a, s) => a + ((s.amount_cents as number) || 0), 0)

    return {
      ok: true,
      data: {
        ...base,
        columns: [
          { key: 'sale_date', label: 'Data' },
          { key: 'lead', label: 'Cliente' },
          { key: 'seller', label: 'Vendedor' },
          { key: 'quantity', label: 'Qtd', align: 'right' },
          { key: 'payment_method', label: 'Pagamento' },
          { key: 'installments', label: 'Parcelas', align: 'right' },
          { key: 'status', label: 'Status' },
          { key: 'amount', label: 'Valor', align: 'right' },
        ],
        rows,
        totals: { lead: `${rows.length} venda(s)`, amount: brl(totalValue) },
      },
    }
  }

  if (type === 'commission') {
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
      (data || []).map(s => s.created_by as string | null),
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

    const totalGross = (data || []).reduce((a, s) => a + ((s.total_cents as number) || 0), 0)
    const totalCommission = (data || []).reduce((a, s) => a + ((s.commission_cents as number) || 0), 0)

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
      sales: (sales || []).map(s => ({
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

  if (type === 'imoveis') {
    const { data, error } = await supabase
      .from('property_deals')
      .select('closed_at, deal_type, final_price_cents, commission_cents, status, properties(title, code), contatos(name)')
      .eq('organization_id', org.id)
      .gte('closed_at', startISO)
      .lte('closed_at', endISO)
      .order('closed_at', { ascending: false })
    if (error) return { ok: false, error: 'query_error' }

    const rows = (data || []).map(d => ({
      closed_at: dt(d.closed_at as string),
      property: relName((d as any).properties) || (d as any).properties?.code || '—',
      lead: relName((d as any).contatos) || '—',
      deal_type: d.deal_type === 'locacao' ? 'Locação' : 'Venda',
      status: d.status === 'aberto' ? 'Fechado' : 'Cancelado',
      commission: brl(d.commission_cents as number),
      amount: brl(d.final_price_cents as number),
    }))
    const totalValue = (data || []).reduce((a, d) => a + ((d.final_price_cents as number) || 0), 0)
    const totalCommission = (data || []).reduce((a, d) => a + ((d.commission_cents as number) || 0), 0)

    return {
      ok: true,
      data: {
        ...base,
        columns: [
          { key: 'closed_at', label: 'Data' },
          { key: 'property', label: 'Imóvel' },
          { key: 'lead', label: 'Lead' },
          { key: 'deal_type', label: 'Tipo' },
          { key: 'status', label: 'Status' },
          { key: 'commission', label: 'Comissão', align: 'right' },
          { key: 'amount', label: 'Valor', align: 'right' },
        ],
        rows,
        totals: { property: `${rows.length} negócio(s)`, commission: brl(totalCommission), amount: brl(totalValue) },
      },
    }
  }

  // appointments
  const { data, error } = await supabase
    .from('appointments')
    .select('start_time, end_time, status, guest_name, guest_email, guest_phone, location, event_type:event_type_id(name), lead:contato_id(name)')
    .eq('organization_id', org.id)
    .gte('start_time', startISO)
    .lte('start_time', endISO)
    .order('start_time', { ascending: false })
  if (error) return { ok: false, error: 'query_error' }

  const rows = (data || []).map(a => ({
    start_time: dt(a.start_time as string),
    event_type: relName((a as any).event_type) || '—',
    guest_name: (a.guest_name as string) || relName((a as any).lead) || '—',
    guest_email: (a.guest_email as string) || '—',
    guest_phone: (a.guest_phone as string) || '—',
    location: (a.location as string) || '—',
    status: APPT_STATUS_PT[a.status as string] || (a.status as string) || '—',
  }))

  return {
    ok: true,
    data: {
      ...base,
      columns: [
        { key: 'start_time', label: 'Início' },
        { key: 'event_type', label: 'Tipo' },
        { key: 'guest_name', label: 'Convidado' },
        { key: 'guest_email', label: 'E-mail' },
        { key: 'guest_phone', label: 'Telefone' },
        { key: 'location', label: 'Local' },
        { key: 'status', label: 'Status' },
      ],
      rows,
      totals: { guest_name: `${rows.length} agendamento(s)` },
    },
  }
}

function isYmd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
}

/** Best-effort name lookup for a set of seller user-ids via the admin auth API. */
async function resolveSellerNames(ids: (string | null)[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const unique = Array.from(new Set(ids.filter((x): x is string => !!x)))
  if (unique.length === 0) return out

  const profiles = await getProfilesMap(unique)
  for (const id of unique) {
    const p = profiles.get(id)
    const name = p?.full_name || p?.email || null
    if (name) out.set(id, name)
  }
  return out
}
