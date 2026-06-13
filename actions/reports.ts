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

export type ReportType = 'leads' | 'sales' | 'appointments' | 'commission'

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
}

export type ReportResult =
  | { ok: true; data: ReportData }
  | { ok: false; error: string }

const TITLES: Record<ReportType, string> = {
  leads: 'Relatório de Leads',
  sales: 'Relatório de Vendas',
  appointments: 'Relatório de Agendamentos',
  commission: 'Relatório de Comissões',
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
      .select('created_by, total_cents, commission_cents, created_at')
      .eq('organization_id', org.id)
      .gte('created_at', startISO)
      .lte('created_at', endISO)
    if (error) return { ok: false, error: 'query_error' }

    const sellerNames = await resolveSellerNames(
      (data || []).map(s => s.created_by as string | null),
    )

    // Aggregate per seller.
    type Agg = { count: number; gross: number; commission: number }
    const bySeller = new Map<string, Agg>()
    for (const s of data || []) {
      const key = (s.created_by as string | null) ?? '__none__'
      const agg = bySeller.get(key) || { count: 0, gross: 0, commission: 0 }
      agg.count += 1
      agg.gross += (s.total_cents as number) || 0
      agg.commission += (s.commission_cents as number) || 0
      bySeller.set(key, agg)
    }

    const rows = Array.from(bySeller.entries())
      .map(([key, agg]) => ({
        seller: key === '__none__' ? 'Sem vendedor' : (sellerNames.get(key) || 'Sem vendedor'),
        count: agg.count,
        gross: brl(agg.gross),
        commission: brl(agg.commission),
        _commission: agg.commission, // sort key, stripped before return
      }))
      .sort((a, b) => b._commission - a._commission)
      .map(({ _commission, ...row }) => row)

    const totalGross = (data || []).reduce((a, s) => a + ((s.total_cents as number) || 0), 0)
    const totalCommission = (data || []).reduce((a, s) => a + ((s.commission_cents as number) || 0), 0)

    return {
      ok: true,
      data: {
        ...base,
        columns: [
          { key: 'seller', label: 'Vendedor' },
          { key: 'count', label: 'Vendas', align: 'right' },
          { key: 'gross', label: 'Valor vendido', align: 'right' },
          { key: 'commission', label: 'Comissão', align: 'right' },
        ],
        rows,
        totals: {
          seller: `${rows.length} vendedor(es)`,
          gross: brl(totalGross),
          commission: brl(totalCommission),
        },
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
