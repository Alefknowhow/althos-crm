'use server'

/**
 * AI credits overview and system alerts. Split out of
 * actions/super-admin.ts.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { isSuperAdmin, getUser } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'
import type { AiCreditsOverview, AiCreditsAccountRow } from './super-admin-billing'

export async function getAiCreditsOverview(period?: string): Promise<AiCreditsOverview> {
  const now = new Date()
  const fallback = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  const p = period && /^\d{4}-\d{2}$/.test(period) ? period : fallback

  if (!(await isSuperAdmin())) {
    return { period: p, totalIncluded: 0, totalPurchased: 0, totalUsed: 0, byAction: [], accounts: [] }
  }

  const admin = createAdminClient()

  const [creditsRes, txRes, accountsRes, subsRes] = await Promise.all([
    admin.from('ai_credits').select('account_id, credits_included, credits_purchased, credits_used').eq('period_month', p),
    admin.from('ai_credit_transactions').select('action, credits_delta, created_at, type'),
    admin.from('accounts').select('id, name'),
    admin.from('subscriptions').select('account_id, plan_id, status'),
  ])

  const nameMap = new Map((accountsRes.data ?? []).map((a: any) => [a.id, a.name]))
  const planMap = new Map<string, string>()
  for (const s of (subsRes.data ?? []) as any[]) {
    if (s.status === 'active' || s.status === 'trialing') planMap.set(s.account_id, s.plan_id)
  }

  // Per-account balances for the period.
  const accounts: AiCreditsAccountRow[] = (creditsRes.data ?? [])
    .map((c: any) => ({
      account_id: c.account_id,
      name:       nameMap.get(c.account_id) ?? '—',
      plan:       planMap.get(c.account_id) ?? 'free',
      included:   c.credits_included ?? 0,
      purchased:  c.credits_purchased ?? 0,
      used:       c.credits_used ?? 0,
      remaining:  (c.credits_included ?? 0) + (c.credits_purchased ?? 0) - (c.credits_used ?? 0),
    }))
    .sort((a, b) => b.used - a.used)

  const totalIncluded  = accounts.reduce((s, a) => s + a.included, 0)
  const totalPurchased = accounts.reduce((s, a) => s + a.purchased, 0)
  const totalUsed      = accounts.reduce((s, a) => s + a.used, 0)

  // Consumption by action — only "consumed" transactions inside the period.
  const actionMap = new Map<string, number>()
  for (const t of (txRes.data ?? []) as any[]) {
    if (t.type !== 'consumed') continue
    if (!t.created_at || t.created_at.slice(0, 7) !== p) continue
    actionMap.set(t.action, (actionMap.get(t.action) ?? 0) + Math.abs(t.credits_delta ?? 0))
  }
  const byAction = Array.from(actionMap.entries())
    .map(([action, used]) => ({ action, used }))
    .sort((a, b) => b.used - a.used)

  return { period: p, totalIncluded, totalPurchased, totalUsed, byAction, accounts }
}

// ---------------------------------------------------------------------------
// System alerts
// ---------------------------------------------------------------------------

export type SystemAlert = {
  id:           string
  severity:     'info' | 'warning' | 'critical'
  type:         string
  title:        string
  message:      string | null
  status:       'open' | 'acknowledged' | 'resolved'
  metadata:     Record<string, any>
  org_name:     string | null
  org_slug:     string | null
  created_at:   string
  resolved_at:  string | null
}

export type AlertCounts = { open: number; critical: number; warning: number }

export async function getSystemAlerts(
  filter: 'open' | 'all' = 'open',
  limit = 200,
): Promise<{ alerts: SystemAlert[]; counts: AlertCounts }> {
  if (!(await isSuperAdmin())) return { alerts: [], counts: { open: 0, critical: 0, warning: 0 } }

  const admin = createAdminClient()

  let query = admin
    .from('system_alerts')
    .select('id, severity, type, title, message, status, metadata, created_at, resolved_at, organizations(name, slug)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (filter === 'open') query = query.in('status', ['open', 'acknowledged'])

  const [{ data }, openRes, critRes, warnRes] = await Promise.all([
    query,
    admin.from('system_alerts').select('id', { count: 'exact', head: true }).in('status', ['open', 'acknowledged']),
    admin.from('system_alerts').select('id', { count: 'exact', head: true }).eq('status', 'open').eq('severity', 'critical'),
    admin.from('system_alerts').select('id', { count: 'exact', head: true }).eq('status', 'open').eq('severity', 'warning'),
  ])

  const alerts: SystemAlert[] = (data ?? []).map((a: any) => ({
    id:          a.id,
    severity:    a.severity,
    type:        a.type,
    title:       a.title,
    message:     a.message,
    status:      a.status,
    metadata:    a.metadata ?? {},
    org_name:    a.organizations?.name ?? null,
    org_slug:    a.organizations?.slug ?? null,
    created_at:  a.created_at,
    resolved_at: a.resolved_at,
  }))

  return {
    alerts,
    counts: { open: openRes.count ?? 0, critical: critRes.count ?? 0, warning: warnRes.count ?? 0 },
  }
}

export async function getOpenAlertCount(): Promise<number> {
  if (!(await isSuperAdmin())) return 0
  const admin = createAdminClient()
  const { count } = await admin
    .from('system_alerts')
    .select('id', { count: 'exact', head: true })
    .in('status', ['open', 'acknowledged'])
  return count ?? 0
}

export async function updateAlertStatus(
  alertId: string,
  status: 'acknowledged' | 'resolved',
) {
  if (!(await isSuperAdmin())) return { ok: false as const, error: 'Não autorizado' }

  const admin = createAdminClient()
  const user = await getUser()

  const patch: Record<string, any> = { status }
  if (status === 'acknowledged') patch.acknowledged_at = new Date().toISOString()
  if (status === 'resolved') {
    patch.resolved_at = new Date().toISOString()
    patch.resolved_by = user?.id ?? null
  }

  const { error } = await admin.from('system_alerts').update(patch).eq('id', alertId)
  if (error) return { ok: false as const, error: error.message }

  revalidatePath('/super-admin/alertas')
  revalidatePath('/super-admin')
  return { ok: true as const }
}

// ---------------------------------------------------------------------------
// Activate managed org
// ---------------------------------------------------------------------------

