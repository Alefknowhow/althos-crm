/**
 * Inngest cron that scans the fleet daily and generates operational alerts
 * into `system_alerts` for the super-admin alert center.
 *
 * Detections (each row is deduped via dedupe_key + partial-unique index, so a
 * recurring condition produces at most one OPEN alert at a time):
 *   - trial_ending   — trial ends within `trial_ending_days` (warning)
 *   - trial_expired  — trial end date already passed, still trialing (critical)
 *   - payment_failed — subscription_status = 'past_due' (critical)
 *   - churn_risk     — active org with no lead activity for `churn_inactive_days` (warning)
 *
 * Thresholds come from system_config.alert_thresholds (with safe defaults).
 */

import { inngest } from './client'
import { createAdminClient } from '@/lib/supabase/server'

type Thresholds = {
  churn_inactive_days: number
  trial_ending_days:   number
  usage_spike_pct:     number
}

const DEFAULTS: Thresholds = {
  churn_inactive_days: 14,
  trial_ending_days:   3,
  usage_spike_pct:     200,
}

type AlertInsert = {
  severity:               'info' | 'warning' | 'critical'
  type:                   string
  title:                  string
  message:                string | null
  target_organization_id: string | null
  target_account_id:      string | null
  dedupe_key:             string
  metadata?:              Record<string, any>
}

export const generateSystemAlertsFn = inngest.createFunction(
  {
    id: 'generate-system-alerts',
    name: 'Geração de alertas do sistema',
    retries: 1,
    triggers: [{ cron: '0 6 * * *' }], // daily at 06:00 UTC
  },
  async ({ step }: { step: any }) => {
    const admin = createAdminClient()

    const thresholds: Thresholds = await step.run('load-thresholds', async () => {
      const { data } = await admin
        .from('system_config')
        .select('value')
        .eq('key', 'alert_thresholds')
        .single()
      return { ...DEFAULTS, ...((data?.value as Partial<Thresholds>) ?? {}) }
    })

    const now = Date.now()
    const trialSoon = new Date(now + thresholds.trial_ending_days * 86400000).toISOString()
    const nowIso = new Date(now).toISOString()
    const churnCutoff = new Date(now - thresholds.churn_inactive_days * 86400000).toISOString()

    // Gather candidate alerts.
    const candidates: AlertInsert[] = await step.run('scan-fleet', async () => {
      const out: AlertInsert[] = []

      const { data: orgs } = await admin
        .from('organizations')
        .select('id, name, account_id, subscription_status, trial_ends_at')
        .limit(2000)

      for (const o of (orgs ?? []) as any[]) {
        const status = o.subscription_status

        if (status === 'past_due') {
          out.push({
            severity: 'critical',
            type: 'payment_failed',
            title: `Pagamento atrasado: ${o.name}`,
            message: 'A assinatura está com status "past_due". Verifique a cobrança.',
            target_organization_id: o.id,
            target_account_id: o.account_id ?? null,
            dedupe_key: `payment_failed:${o.id}`,
          })
        }

        if (status === 'trialing' && o.trial_ends_at) {
          if (o.trial_ends_at < nowIso) {
            out.push({
              severity: 'critical',
              type: 'trial_expired',
              title: `Trial expirado: ${o.name}`,
              message: 'O período de teste terminou e a conta ainda está em trialing.',
              target_organization_id: o.id,
              target_account_id: o.account_id ?? null,
              dedupe_key: `trial_expired:${o.id}`,
              metadata: { trial_ends_at: o.trial_ends_at },
            })
          } else if (o.trial_ends_at <= trialSoon) {
            out.push({
              severity: 'warning',
              type: 'trial_ending',
              title: `Trial terminando: ${o.name}`,
              message: `O período de teste termina em breve (${new Date(o.trial_ends_at).toLocaleDateString('pt-BR')}).`,
              target_organization_id: o.id,
              target_account_id: o.account_id ?? null,
              dedupe_key: `trial_ending:${o.id}`,
              metadata: { trial_ends_at: o.trial_ends_at },
            })
          }
        }
      }

      // Churn risk: active orgs with no recent lead activity.
      const activeOrgs = (orgs ?? []).filter((o: any) => o.subscription_status === 'active')
      for (const o of activeOrgs as any[]) {
        const { count: recent } = await admin
          .from('leads')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', o.id)
          .gte('last_activity_at', churnCutoff)

        if ((recent ?? 0) === 0) {
          // Only flag orgs that actually have leads (skip brand-new empty orgs).
          const { count: total } = await admin
            .from('leads')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', o.id)
          if ((total ?? 0) > 0) {
            out.push({
              severity: 'warning',
              type: 'churn_risk',
              title: `Risco de churn: ${o.name}`,
              message: `Sem atividade em leads há mais de ${thresholds.churn_inactive_days} dias.`,
              target_organization_id: o.id,
              target_account_id: o.account_id ?? null,
              dedupe_key: `churn_risk:${o.id}`,
            })
          }
        }
      }

      return out
    })

    if (candidates.length === 0) return { created: 0, scanned: true }

    // Skip candidates that already have an OPEN alert with the same dedupe_key.
    const created = await step.run('insert-new', async () => {
      const keys = candidates.map(c => c.dedupe_key)
      const { data: existing } = await admin
        .from('system_alerts')
        .select('dedupe_key')
        .in('dedupe_key', keys)
        .eq('status', 'open')
      const taken = new Set((existing ?? []).map((e: any) => e.dedupe_key))

      const toInsert = candidates
        .filter(c => !taken.has(c.dedupe_key))
        .map(c => ({ ...c, metadata: c.metadata ?? {} }))

      if (toInsert.length === 0) return 0
      const { error } = await admin.from('system_alerts').insert(toInsert)
      if (error) throw new Error(error.message)
      return toInsert.length
    })

    return { created, candidates: candidates.length }
  },
)
