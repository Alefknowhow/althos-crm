/**
 * Resumo diário por e-mail — todo dia às 7h (horário de Brasília) pro
 * owner/admin de cada org que tiver org_settings.digest_enabled = true.
 * Mesmos dados/HTML de actions/digest.ts::previewDailyDigest, via
 * lib/digest/daily-digest.ts (fonte única, pra preview e envio nunca
 * divergirem).
 */

import { inngest } from './client'
import { createAdminClient } from '@/lib/supabase/server'
import { resend, EMAIL_FROM } from '@/lib/resend'
import { buildDigestData, buildDigestHtml } from '@/lib/digest/daily-digest'

interface OrgWithOwner {
  id: string
  name: string
  slug: string
  niche: string | null
  memberships: Array<{ role: string; profiles: { email: string } | null }>
}

export const dailyOwnerDigestFn = inngest.createFunction(
  {
    id: 'daily-owner-digest',
    name: 'Resumo diário por e-mail (7h Brasília)',
    retries: 2,
    triggers: [{ cron: '0 10 * * *' }], // 10:00 UTC = 07:00 America/Sao_Paulo
  },
  async ({ step }: { step: any }) => {
    const admin = createAdminClient()

    const orgs: OrgWithOwner[] = await step.run('fetch-digest-orgs', async () => {
      const { data } = await admin
        .from('organizations')
        .select('id, name, slug, niche, org_settings!inner(digest_enabled), memberships(role, profiles(email))')
        .eq('org_settings.digest_enabled', true)
        .limit(500)
      return (data as unknown as OrgWithOwner[]) ?? []
    })

    let sent = 0

    for (const org of orgs) {
      const ownerMembership = org.memberships.find(m => m.role === 'owner') || org.memberships.find(m => m.role === 'admin')
      const email = ownerMembership?.profiles?.email
      if (!email) continue

      await step.run(`send-digest-${org.id}`, async () => {
        try {
          const data = await buildDigestData(admin, org.id, org.niche)
          const totalItems = data.overdueTasks.length + data.todayTasks.length + (data.todayTrips?.length ?? 0) + (data.weekTrips?.length ?? 0)
          const subject = data.overdueTasks.length > 0
            ? `⚠️ ${data.overdueTasks.length} tarefa(s) em atraso — resumo de hoje`
            : `☀️ Seu resumo de hoje — ${totalItems} item(ns)`

          await resend.emails.send({
            from: EMAIL_FROM,
            to: email,
            subject,
            html: buildDigestHtml(org.name, org.slug, data),
          })
          sent++
        } catch (err) {
          console.error(`[daily-digest] failed for org ${org.id}:`, err)
        }
      })
    }

    return { sent, checked: orgs.length }
  }
)
