/**
 * Orchestrates all integration probes for a single organization and persists
 * the results into `integration_health_checks`.
 *
 * Plain server module (NOT a 'use server' action file) so it can be imported
 * both by the Inngest cron and by the on-demand server action without turning
 * every export into a server-action endpoint.
 */

import { createAdminClient } from '@/lib/supabase/server'
import {
  checkWhatsapp,
  checkEmail,
  checkInngest,
  checkSupabase,
  type HealthResult,
} from './checks'

export interface OrgForHealth {
  id: string
  whatsapp_phone_number_id?: string | null
  whatsapp_access_token?: string | null
  email_from_address?: string | null
}

/**
 * Runs every probe for one org and writes one row per integration.
 * Never throws — probe failures are already encoded as 'error'/'warning'
 * results; only a catastrophic DB write failure is swallowed and logged.
 */
export async function runHealthChecksForOrg(org: OrgForHealth): Promise<HealthResult[]> {
  const admin = createAdminClient()

  // Inngest health proxy: failure rate of automation runs over the last 24h.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  let recentTotal = 0
  let recentFailures = 0
  try {
    const { data: runs } = await admin
      .from('automation_runs')
      .select('status')
      .eq('organization_id', org.id)
      .gte('started_at', since)
    recentTotal = runs?.length ?? 0
    recentFailures = (runs ?? []).filter((r: any) => r.status === 'failed').length
  } catch {
    /* leave counts at 0 — Inngest check still reports "configured" */
  }

  const results = await Promise.all([
    checkWhatsapp(org),
    checkEmail(org),
    Promise.resolve(checkInngest({ recentTotal, recentFailures })),
    checkSupabase({
      pingDb: async () => {
        const { error } = await admin.from('organizations').select('id').limit(1)
        return !error
      },
      pingStorage: async () => {
        const { error } = await admin.storage.listBuckets()
        return !error
      },
    }),
  ])

  // Persist one row per integration. Best-effort: a write failure for one row
  // should not block the others, so we insert as a batch and log on failure.
  try {
    await admin.from('integration_health_checks').insert(
      results.map(r => ({
        organization_id: org.id,
        integration_name: r.integration,
        status: r.status,
        details_json: { summary: r.summary, details: r.details, meta: r.meta ?? null },
        checked_at: r.checkedAt,
      })),
    )
  } catch (e) {
    console.error('[health] failed to persist results for org', org.id, e)
  }

  return results
}

/**
 * Deletes health rows older than `keepDays` (retention). Returns the cutoff
 * ISO used, for logging. Service-role only.
 */
export async function pruneHealthHistory(keepDays = 35): Promise<string> {
  const admin = createAdminClient()
  const cutoff = new Date(Date.now() - keepDays * 24 * 60 * 60 * 1000).toISOString()
  try {
    await admin.from('integration_health_checks').delete().lt('checked_at', cutoff)
  } catch (e) {
    console.error('[health] retention prune failed', e)
  }
  return cutoff
}
