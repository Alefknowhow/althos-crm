/**
 * Inngest cron functions that fire automation trigger events for:
 *
 *  1. automation-stale-leads  — daily at 8 AM, fires `lead.stale` for every
 *     lead whose last activity is older than the configured staleDays.
 *
 *  2. automation-task-overdue — daily at 8 AM (alongside push cron), fires
 *     `task.overdue` for every lead-linked overdue task so automations can
 *     react (e.g. send a WhatsApp, create a follow-up task, move stage).
 */

import { inngest } from './client'
import { createAdminClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// 1. Stale-lead scanner — daily at 08:00
// ---------------------------------------------------------------------------

export const automationStaleLeadsFn = inngest.createFunction(
  {
    id:      'automation-stale-leads',
    name:    'Automação: leads parados',
    retries: 1,
    triggers: [{ cron: '0 8 * * *' }],
  },
  async ({ step }: { step: any }) => {
    const admin = createAdminClient()
    const now   = new Date()

    // Fetch all active stale-lead automations so we know which thresholds are configured.
    const automations: Array<{
      id:              string
      organization_id: string
      trigger_config:  { staleDays?: number }
    }> = await step.run('fetch-stale-automations', async () => {
      const { data } = await admin
        .from('automations')
        .select('id, organization_id, trigger_config')
        .eq('trigger_type', 'lead.stale')
        .eq('is_active', true)
      return data || []
    })

    if (automations.length === 0) return { fired: 0 }

    // Collect unique (orgId → staleDays) pairs to query efficiently.
    const orgThresholds = new Map<string, number>()
    for (const a of automations) {
      const days = a.trigger_config?.staleDays ?? 7
      // Use the smallest threshold for the org so we over-fetch, not under-fetch.
      const existing = orgThresholds.get(a.organization_id) ?? Infinity
      if (days < existing) orgThresholds.set(a.organization_id, days)
    }

    let totalFired = 0

    const entries = Array.from(orgThresholds.entries())
    for (const [orgId, staleDays] of entries) {
      const cutoff = new Date(now)
      cutoff.setDate(cutoff.getDate() - staleDays)
      const cutoffISO = cutoff.toISOString()

      // Leads that either have no activity at all, or whose last activity
      // predates the cutoff — and are still open (not converted/lost).
      const leads: Array<{ id: string }> = await step.run(
        `fetch-stale-leads-${orgId}`,
        async () => {
          const { data } = await admin
            .from('leads')
            .select('id')
            .eq('organization_id', orgId)
            .not('status', 'in', '("won","lost")')
            .or(`last_activity_at.is.null,last_activity_at.lt.${cutoffISO}`)
            .limit(100)
          return data || []
        }
      )

      for (const lead of leads) {
        await step.run(`fire-stale-${orgId}-${lead.id}`, async () => {
          await inngest.send({
            name: 'lead.stale',
            data: { orgId, leadId: lead.id, staleDays },
          })
          totalFired++
        })
      }
    }

    return { fired: totalFired }
  }
)

// ---------------------------------------------------------------------------
// 2. Overdue-task automation events — daily at 08:05
// ---------------------------------------------------------------------------

export const automationTaskOverdueFn = inngest.createFunction(
  {
    id:      'automation-task-overdue',
    name:    'Automação: tarefas vencidas',
    retries: 1,
    triggers: [{ cron: '5 8 * * *' }],
  },
  async ({ step }: { step: any }) => {
    const admin = createAdminClient()
    const now   = new Date().toISOString()

    // Only fire for tasks that have a lead_id (so the automation can act on the lead)
    // and only for orgs that have at least one active task.overdue automation.
    const orgIds: string[] = await step.run('fetch-orgs-with-task-overdue-automations', async () => {
      const { data } = await admin
        .from('automations')
        .select('organization_id')
        .eq('trigger_type', 'task.overdue')
        .eq('is_active', true)
      if (!data) return []
      // Unique org IDs
      const seen = new Set<string>()
      for (const row of data) seen.add(row.organization_id)
      return Array.from(seen)
    })

    if (orgIds.length === 0) return { fired: 0 }

    const tasks: Array<{
      id:              string
      title:           string
      organization_id: string
      lead_id:         string
    }> = await step.run('fetch-overdue-tasks-for-automations', async () => {
      const { data } = await admin
        .from('tasks')
        .select('id, title, organization_id, lead_id')
        .eq('status', 'open')
        .lt('due_date', now)
        .not('lead_id', 'is', null)
        .in('organization_id', orgIds)
        .limit(200)
      return data || []
    })

    let totalFired = 0

    for (const task of tasks) {
      await step.run(`fire-task-overdue-${task.id}`, async () => {
        await inngest.send({
          name: 'task.overdue',
          data: {
            orgId:  task.organization_id,
            leadId: task.lead_id,
            taskId: task.id,
            title:  task.title,
          },
        })
        totalFired++
      })
    }

    return { fired: totalFired }
  }
)

// ---------------------------------------------------------------------------
// 3. Customer birthday — daily at 07:00
//    Fires `customer.birthday` for every customer whose date_of_birth matches
//    today's month/day, in orgs that have an active customer.birthday automation.
// ---------------------------------------------------------------------------

export const automationCustomerBirthdayFn = inngest.createFunction(
  {
    id:      'automation-customer-birthday',
    name:    'Automação: aniversário do cliente',
    retries: 1,
    triggers: [{ cron: '0 7 * * *' }],
  },
  async ({ step }: { step: any }) => {
    const admin = createAdminClient()

    // Orgs that have at least one active birthday automation.
    const orgIds: string[] = await step.run('fetch-orgs-with-birthday-automations', async () => {
      const { data } = await admin
        .from('automations')
        .select('organization_id')
        .eq('trigger_type', 'customer.birthday')
        .eq('is_active', true)
      if (!data) return []
      return Array.from(new Set(data.map((r: any) => r.organization_id)))
    })

    if (orgIds.length === 0) return { fired: 0 }

    // Today's month/day in São Paulo time, so birthdays fire on the local date.
    const dtParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date())
    const mm = dtParts.find(p => p.type === 'month')?.value ?? '01'
    const dd = dtParts.find(p => p.type === 'day')?.value ?? '01'

    // Profiles whose birthday is today (ignoring year). We over-fetch by
    // matching the MM-DD suffix via two range filters per org would be complex,
    // so we pull profiles with a non-null DOB for these orgs and filter in JS.
    const profiles: Array<{ lead_id: string; organization_id: string; date_of_birth: string }> =
      await step.run('fetch-birthday-profiles', async () => {
        const { data } = await admin
          .from('customer_profiles')
          .select('lead_id, organization_id, date_of_birth')
          .in('organization_id', orgIds)
          .not('date_of_birth', 'is', null)
          .not('lead_id', 'is', null)
          .limit(5000)
        return (data || []).filter((p: any) => {
          const d = String(p.date_of_birth) // 'YYYY-MM-DD'
          return d.slice(5, 7) === mm && d.slice(8, 10) === dd
        })
      })

    let totalFired = 0
    for (const profile of profiles) {
      await step.run(`fire-birthday-${profile.lead_id}`, async () => {
        await inngest.send({
          name: 'customer.birthday',
          data: { orgId: profile.organization_id, leadId: profile.lead_id },
        })
        totalFired++
      })
    }

    return { fired: totalFired }
  }
)
