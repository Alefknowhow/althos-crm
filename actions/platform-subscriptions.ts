'use server'

import { isSuperAdmin } from '@/lib/supabase/types'
import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Painel operacional do super-admin (ver app/super-admin/plataforma) — gestão
 * das assinaturas dos provedores que sustentam a própria plataforma Althos
 * (Supabase, Vercel, Resend, Inngest, Cloudflare, Anthropic, Gemini). Dado
 * global, sem organization_id — ver supabase/migrations/0213_platform_subscriptions.sql.
 * Todo mundo aqui usa createAdminClient() (bypassa RLS) + checagem manual de
 * isSuperAdmin(), mesmo padrão do resto de actions/super-admin.ts.
 */

export type PlatformVendor = 'supabase' | 'vercel' | 'resend' | 'inngest' | 'cloudflare' | 'anthropic' | 'gemini' | 'outro'

export type PlatformSubscription = {
  id: string
  vendor: PlatformVendor
  vendor_label: string | null
  plan_name: string
  status: 'ativo' | 'trial' | 'pausado' | 'cancelado'
  billing_cycle: 'mensal' | 'anual' | 'uso'
  cost_usd_cents: number | null
  cost_brl_cents: number | null
  fx_rate_used: number | null
  started_at: string | null
  renewed_at: string | null
  due_date: string | null
  auto_renew: boolean
  payment_method: string | null
  external_url: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export async function listPlatformSubscriptions(): Promise<PlatformSubscription[]> {
  if (!(await isSuperAdmin())) return []
  const admin = createAdminClient()
  const { data } = await admin
    .from('platform_subscriptions')
    .select('*')
    .order('due_date', { ascending: true, nullsFirst: false })
  return (data as PlatformSubscription[]) || []
}

export type PlatformSubscriptionInput = {
  vendor: PlatformVendor
  vendor_label?: string | null
  plan_name: string
  status: PlatformSubscription['status']
  billing_cycle: PlatformSubscription['billing_cycle']
  cost_usd_cents?: number | null
  cost_brl_cents?: number | null
  fx_rate_used?: number | null
  started_at?: string | null
  renewed_at?: string | null
  due_date?: string | null
  auto_renew?: boolean
  payment_method?: string | null
  external_url?: string | null
  notes?: string | null
}

export async function createPlatformSubscription(input: PlatformSubscriptionInput) {
  if (!(await isSuperAdmin())) return { ok: false as const, error: 'Não autorizado' }
  if (!input.plan_name?.trim()) return { ok: false as const, error: 'Informe o nome do plano.' }
  const admin = createAdminClient()
  const { error } = await admin.from('platform_subscriptions').insert({
    vendor: input.vendor,
    vendor_label: input.vendor === 'outro' ? (input.vendor_label || null) : null,
    plan_name: input.plan_name.trim(),
    status: input.status,
    billing_cycle: input.billing_cycle,
    cost_usd_cents: input.cost_usd_cents ?? null,
    cost_brl_cents: input.cost_brl_cents ?? null,
    fx_rate_used: input.fx_rate_used ?? null,
    started_at: input.started_at || null,
    renewed_at: input.renewed_at || null,
    due_date: input.due_date || null,
    auto_renew: input.auto_renew ?? true,
    payment_method: input.payment_method || null,
    external_url: input.external_url || null,
    notes: input.notes || null,
  })
  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/super-admin/plataforma')
  return { ok: true as const }
}

export async function updatePlatformSubscription(id: string, input: Partial<PlatformSubscriptionInput>) {
  if (!(await isSuperAdmin())) return { ok: false as const, error: 'Não autorizado' }
  const admin = createAdminClient()
  const patch: Record<string, unknown> = {}
  if (input.vendor !== undefined) patch.vendor = input.vendor
  if (input.vendor_label !== undefined) patch.vendor_label = input.vendor === 'outro' ? (input.vendor_label || null) : null
  if (input.plan_name !== undefined) patch.plan_name = input.plan_name.trim()
  if (input.status !== undefined) patch.status = input.status
  if (input.billing_cycle !== undefined) patch.billing_cycle = input.billing_cycle
  if (input.cost_usd_cents !== undefined) patch.cost_usd_cents = input.cost_usd_cents
  if (input.cost_brl_cents !== undefined) patch.cost_brl_cents = input.cost_brl_cents
  if (input.fx_rate_used !== undefined) patch.fx_rate_used = input.fx_rate_used
  if (input.started_at !== undefined) patch.started_at = input.started_at || null
  if (input.renewed_at !== undefined) patch.renewed_at = input.renewed_at || null
  if (input.due_date !== undefined) patch.due_date = input.due_date || null
  if (input.auto_renew !== undefined) patch.auto_renew = input.auto_renew
  if (input.payment_method !== undefined) patch.payment_method = input.payment_method || null
  if (input.external_url !== undefined) patch.external_url = input.external_url || null
  if (input.notes !== undefined) patch.notes = input.notes || null

  const { error } = await admin.from('platform_subscriptions').update(patch).eq('id', id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/super-admin/plataforma')
  return { ok: true as const }
}

export async function deletePlatformSubscription(id: string) {
  if (!(await isSuperAdmin())) return { ok: false as const, error: 'Não autorizado' }
  const admin = createAdminClient()
  const { error } = await admin.from('platform_subscriptions').delete().eq('id', id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/super-admin/plataforma')
  return { ok: true as const }
}

// ── Consumo (usage logs) ──────────────────────────────────────────────────────

export type PlatformUsageLog = {
  id: string
  subscription_id: string | null
  vendor: PlatformVendor
  period_start: string
  period_end: string
  metric_label: string
  metric_value: number
  cost_usd_cents: number | null
  notes: string | null
  created_at: string
}

export async function listPlatformUsageLogs(subscriptionId: string): Promise<PlatformUsageLog[]> {
  if (!(await isSuperAdmin())) return []
  const admin = createAdminClient()
  const { data } = await admin
    .from('platform_usage_logs')
    .select('*')
    .eq('subscription_id', subscriptionId)
    .order('period_start', { ascending: false })
  return (data as PlatformUsageLog[]) || []
}

export type PlatformUsageLogInput = {
  subscription_id: string
  vendor: PlatformVendor
  period_start: string
  period_end: string
  metric_label: string
  metric_value: number
  cost_usd_cents?: number | null
  notes?: string | null
}

export async function createPlatformUsageLog(input: PlatformUsageLogInput) {
  if (!(await isSuperAdmin())) return { ok: false as const, error: 'Não autorizado' }
  if (!input.metric_label?.trim()) return { ok: false as const, error: 'Informe a métrica.' }
  if (!input.period_start || !input.period_end) return { ok: false as const, error: 'Informe o período.' }
  const admin = createAdminClient()
  const { error } = await admin.from('platform_usage_logs').insert({
    subscription_id: input.subscription_id,
    vendor: input.vendor,
    period_start: input.period_start,
    period_end: input.period_end,
    metric_label: input.metric_label.trim(),
    metric_value: input.metric_value,
    cost_usd_cents: input.cost_usd_cents ?? null,
    notes: input.notes || null,
  })
  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/super-admin/plataforma')
  return { ok: true as const }
}

export async function deletePlatformUsageLog(id: string) {
  if (!(await isSuperAdmin())) return { ok: false as const, error: 'Não autorizado' }
  const admin = createAdminClient()
  const { error } = await admin.from('platform_usage_logs').delete().eq('id', id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/super-admin/plataforma')
  return { ok: true as const }
}

// ── Resumo de custos ──────────────────────────────────────────────────────────

export type PlatformCostSummary = {
  monthlyFixedUsdCents: number
  monthlyFixedBrlCents: number
  activeCount: number
  dueSoonCount: number // vencendo em até 7 dias
  overdueCount: number
}

export async function getPlatformCostSummary(): Promise<PlatformCostSummary> {
  const subs = await listPlatformSubscriptions()
  const active = subs.filter(s => s.status === 'ativo' || s.status === 'trial')

  let monthlyFixedUsdCents = 0
  let monthlyFixedBrlCents = 0
  for (const s of active) {
    if (s.billing_cycle === 'uso') continue // custo variável — não entra no fixo
    const divisor = s.billing_cycle === 'anual' ? 12 : 1
    monthlyFixedUsdCents += Math.round((s.cost_usd_cents || 0) / divisor)
    monthlyFixedBrlCents += Math.round((s.cost_brl_cents || 0) / divisor)
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const in7Days = new Date(today)
  in7Days.setDate(in7Days.getDate() + 7)

  let dueSoonCount = 0
  let overdueCount = 0
  for (const s of active) {
    if (!s.due_date) continue
    const due = new Date(`${s.due_date}T00:00:00`)
    if (due < today) overdueCount++
    else if (due <= in7Days) dueSoonCount++
  }

  return {
    monthlyFixedUsdCents,
    monthlyFixedBrlCents,
    activeCount: active.length,
    dueSoonCount,
    overdueCount,
  }
}
