'use server'

/**
 * Leads and sales report datasets.
 * Split out of actions/reports.ts.
 */

import { isTravelNiche } from '@/lib/niche'
import {
  brl, dt, dateOnly, relName, SALES_STATUS_PT, resolveSellerNames,
  type ReportCtx, type ReportResult,
} from './reports-shared'

export async function getLeadsReport(ctx: ReportCtx): Promise<ReportResult> {
  const { supabase, org, startISO, endISO, base } = ctx
  const { data, error } = await supabase
    .from('contatos')
    .select('name, email, phone, source, value_cents, created_at, stage:stage_id(name)')
    .eq('organization_id', org.id)
    .gte('created_at', startISO)
    .lte('created_at', endISO)
    .order('created_at', { ascending: false })
  if (error) return { ok: false, error: 'query_error' }

  const rows = (data || []).map((l: any) => ({
    created_at: dt(l.created_at as string),
    name: (l.name as string) || '—',
    email: (l.email as string) || '—',
    phone: (l.phone as string) || '—',
    source: (l.source as string) || '—',
    stage: relName((l as any).stage) || '—',
    value: brl(l.value_cents as number),
  }))
  const totalValue = (data || []).reduce((a: number, l: any) => a + ((l.value_cents as number) || 0), 0)

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

export async function getSalesReport(ctx: ReportCtx): Promise<ReportResult> {
  const { supabase, org, startISO, endISO, from, to, base } = ctx

  // Agências de viagem registram venda em travel_sales (reservas), não na
  // tabela genérica `sales` — mesma fonte já usada pelo relatório de
  // comissão (ver bloco `commission`) e pelo dashboard
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
      (data || []).map((s: any) => s.created_by as string | null),
    )

    const rows = (data || []).map((s: any) => ({
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
    const totalValue = (data || []).reduce((a: number, s: any) => a + ((s.total_cents as number) || 0), 0)

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
    (data || []).map((s: any) => s.seller_id as string | null),
  )

  const rows = (data || []).map((s: any) => ({
    sale_date: dateOnly(s.sale_date as string),
    lead: relName((s as any).lead) || '—',
    seller: (s.seller_id && sellerNames.get(s.seller_id as string)) || '—',
    quantity: (s.quantity as number) ?? 1,
    payment_method: (s.payment_method as string) || '—',
    installments: (s.installments as number) ?? 1,
    status: SALES_STATUS_PT[s.status as string] || (s.status as string) || '—',
    amount: brl(s.amount_cents as number),
  }))
  const totalValue = (data || []).reduce((a: number, s: any) => a + ((s.amount_cents as number) || 0), 0)

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
