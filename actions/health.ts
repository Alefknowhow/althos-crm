'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/supabase/types'
import { runHealthChecksForOrg } from '@/lib/health/run'
import type { HealthStatus, IntegrationName, HealthDetailCheck } from '@/lib/health/checks'
import { revalidatePath } from 'next/cache'

export interface LatestHealthRow {
  integration: IntegrationName
  status: HealthStatus
  summary: string
  details: HealthDetailCheck[]
  meta: Record<string, unknown> | null
  checkedAt: string
}

export interface AvailabilityPoint {
  day: string // YYYY-MM-DD
  integration: IntegrationName
  total: number
  up: number
  uptimePct: number
}

/**
 * Latest health row per integration for the org (read via RLS).
 * Pulls the most recent rows and reduces to the first seen per integration.
 */
export async function getLatestHealth(orgSlug: string): Promise<LatestHealthRow[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data } = await supabase
    .from('integration_health_checks')
    .select('integration_name, status, details_json, checked_at')
    .eq('organization_id', org.id)
    .order('checked_at', { ascending: false })
    .limit(80)

  const seen = new Map<string, LatestHealthRow>()
  for (const row of data ?? []) {
    const name = (row as any).integration_name as IntegrationName
    if (seen.has(name)) continue
    const dj = ((row as any).details_json ?? {}) as any
    seen.set(name, {
      integration: name,
      status: (row as any).status,
      summary: dj.summary ?? '',
      details: Array.isArray(dj.details) ? dj.details : [],
      meta: dj.meta ?? null,
      checkedAt: (row as any).checked_at,
    })
  }

  // Stable display order.
  const order: IntegrationName[] = ['whatsapp', 'email', 'inngest', 'supabase']
  return order.filter(n => seen.has(n)).map(n => seen.get(n)!)
}

/** Daily availability for the last `days` days, aggregated in the DB. */
export async function getAvailability(orgSlug: string, days = 30): Promise<AvailabilityPoint[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data, error } = await supabase.rpc('health_availability_daily', {
    p_org: org.id,
    p_days: days,
  })
  if (error || !data) return []

  return (data as any[]).map(r => ({
    day: String(r.day),
    integration: r.integration_name as IntegrationName,
    total: Number(r.total),
    up: Number(r.up),
    uptimePct: r.uptime_pct == null ? 0 : Number(r.uptime_pct),
  }))
}

/**
 * On-demand "Verificar agora" — runs all probes for the org and persists rows.
 * Membership is enforced by getCurrentOrganization (RLS 404 if not a member).
 */
export async function runHealthCheckNow(orgSlug: string) {
  const org = (await getCurrentOrganization(orgSlug)) as any
  try {
    const results = await runHealthChecksForOrg({
      id: org.id,
      whatsapp_phone_number_id: org.whatsapp_phone_number_id,
      whatsapp_access_token: org.whatsapp_access_token,
      email_from_address: org.email_from_address,
    })
    revalidatePath(`/app/${orgSlug}/configuracoes/integracoes/saude`)
    return { ok: true as const, count: results.length }
  } catch (e: any) {
    return { ok: false as const, error: e?.message || 'Falha ao executar verificação' }
  }
}
