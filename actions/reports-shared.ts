/**
 * Shared types/helpers for the report datasets. No 'use server' directive —
 * split out of actions/reports.ts, and this file exports plain consts/
 * functions (not just async actions), which 'use server' files can't do.
 */

import { getProfilesMap } from '@/lib/profiles'

export type ReportType = 'leads' | 'sales' | 'appointments' | 'commission' | 'imoveis' | 'attendances' | 'retornos'

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

/** Shared context threaded into each per-type report builder. */
export interface ReportCtx {
  orgSlug: string
  org: any
  supabase: any
  base: Omit<ReportData, 'columns' | 'rows' | 'totals'>
  from: string
  to: string
  startISO: string
  endISO: string
  periodLabel: string
  groupBy: CommissionGroupBy
}

export const TITLES: Record<ReportType, string> = {
  leads: 'Relatório de Leads',
  sales: 'Relatório de Vendas',
  appointments: 'Relatório de Agendamentos',
  commission: 'Relatório de Reservas',
  imoveis: 'Relatório de Imóveis',
  attendances: 'Relatório de Atendimentos',
  retornos: 'Relatório de Retornos',
}

export function brl(cents: number | null | undefined): string {
  return ((cents ?? 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function dt(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
  })
}

export function dateOnly(d: string | null | undefined): string {
  if (!d) return '—'
  // sale_date is a plain date; render without TZ shifting.
  const [y, m, day] = d.slice(0, 10).split('-')
  return `${day}/${m}/${y}`
}

export function relName(rel: unknown): string | null {
  if (!rel) return null
  const r = Array.isArray(rel) ? rel[0] : rel
  return (r as any)?.name ?? null
}

export const SALES_STATUS_PT: Record<string, string> = {
  completed: 'Concluída', pending: 'Pendente', canceled: 'Cancelada', refunded: 'Estornada',
}
export const APPT_STATUS_PT: Record<string, string> = {
  scheduled: 'Agendado', completed: 'Realizado', canceled: 'Cancelado', no_show: 'Não compareceu',
}

export function isYmd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
}

/** Best-effort name lookup for a set of seller user-ids via the admin auth API. */
export async function resolveSellerNames(ids: (string | null)[]): Promise<Map<string, string>> {
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
