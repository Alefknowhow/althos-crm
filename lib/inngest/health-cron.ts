/**
 * Inngest cron that probes every organization's integrations on a fixed
 * cadence and records the result in `integration_health_checks`, plus a daily
 * retention sweep.
 *
 *  1. integration-health-check — every 15 minutes, runs all probes per org.
 *  2. integration-health-prune — daily, deletes rows older than 35 days.
 */

import { inngest } from './client'
import { createAdminClient } from '@/lib/supabase/server'
import { runHealthChecksForOrg, pruneHealthHistory } from '@/lib/health/run'

// ---------------------------------------------------------------------------
// 1. Health probe — every 15 minutes
// ---------------------------------------------------------------------------

export const integrationHealthCheckFn = inngest.createFunction(
  {
    id: 'integration-health-check',
    name: 'Saúde das integrações',
    retries: 1,
    // Bound concurrency so a large fleet doesn't hammer Meta/Resend at once.
    concurrency: { limit: 5 },
    triggers: [{ cron: '*/15 * * * *' }],
  },
  async ({ step }: { step: any }) => {
    const admin = createAdminClient()

    // Only real tenants — skip internal/platform orgs. Bounded for safety.
    const orgs: Array<{
      id: string
      whatsapp_phone_number_id: string | null
      whatsapp_access_token: string | null
      email_from_address: string | null
    }> = await step.run('fetch-orgs', async () => {
      const { data } = await admin
        .from('organizations')
        .select('id, whatsapp_phone_number_id, whatsapp_access_token, email_from_address')
        .limit(1000)
      return data || []
    })

    let checked = 0
    for (const org of orgs) {
      // One durable step per org: failures isolate and Inngest checkpoints.
      await step.run(`probe-${org.id}`, async () => {
        await runHealthChecksForOrg(org)
        checked++
      })
    }

    return { checked }
  },
)

// ---------------------------------------------------------------------------
// 2. Retention sweep — daily at 03:00
// ---------------------------------------------------------------------------

export const integrationHealthPruneFn = inngest.createFunction(
  {
    id: 'integration-health-prune',
    name: 'Saúde das integrações: limpeza',
    retries: 1,
    triggers: [{ cron: '0 3 * * *' }],
  },
  async ({ step }: { step: any }) => {
    const cutoff = await step.run('prune', async () => pruneHealthHistory(35))
    return { cutoff }
  },
)
