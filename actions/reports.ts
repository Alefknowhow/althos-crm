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
 *
 * Split across reports-shared.ts (types/helpers, no directive) and
 * reports-leads-sales.ts / reports-commission.ts / reports-other.ts
 * (per-type builders). This file is a slim dispatcher.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkFeatureAccessByOrgSlug } from '@/lib/plans/server'
import {
  TITLES, isYmd, dateOnly,
  type ReportType, type CommissionGroupBy, type ReportData, type ReportResult, type ReportCtx,
} from './reports-shared'
import { getLeadsReport, getSalesReport } from './reports-leads-sales'
import { getCommissionReport } from './reports-commission'
import { getImoveisReport, getAppointmentsReport, getAttendancesReport, getRetornosReport } from './reports-other'

export type { ReportType, CommissionGroupBy, ReportColumn, ReportData, ReportResult } from './reports-shared'

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

  const ctx: ReportCtx = { orgSlug, org, supabase, base, from, to, startISO, endISO, periodLabel, groupBy }

  if (type === 'leads') return getLeadsReport(ctx)
  if (type === 'sales') return getSalesReport(ctx)
  if (type === 'commission') return getCommissionReport(ctx)
  if (type === 'imoveis') return getImoveisReport(ctx)
  if (type === 'appointments') return getAppointmentsReport(ctx)
  if (type === 'attendances') return getAttendancesReport(ctx)
  return getRetornosReport(ctx)
}
