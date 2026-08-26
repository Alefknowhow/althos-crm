/**
 * Resumo diário por e-mail — todo dia às 7h (horário de Brasília) pra cada
 * membro de uma org com org_settings.digest_enabled = true:
 *  - owner/admin ("gestor principal") recebe o resumo da equipe inteira
 *    (todas as tarefas e embarques da org, não só os dele).
 *  - member recebe só o que é dele: tarefas com assigned_to = ele e
 *    embarques das vendas que ele fechou (created_by = ele).
 * Mesmos dados/HTML de actions/digest.ts::previewDailyDigest, via
 * lib/digest/daily-digest.ts (fonte única, pra preview e envio nunca
 * divergirem).
 */

import { inngest } from './client'
import { createAdminClient } from '@/lib/supabase/server'
import { resend, EMAIL_FROM } from '@/lib/resend'
import { buildDigestData, buildDigestHtml } from '@/lib/digest/daily-digest'

interface OrgWithMembers {
  id: string
  name: string
  slug: string
  niche: string | null
  memberships: Array<{ user_id: string; role: string; profiles: { email: string } | null }>
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

    const orgs: OrgWithMembers[] = await step.run('fetch-digest-orgs', async () => {
      const { data } = await admin
        .from('organizations')
        .select('id, name, slug, niche, org_settings!inner(digest_enabled), memberships(user_id, role, profiles(email))')
        .eq('org_settings.digest_enabled', true)
        .limit(500)
      return (data as unknown as OrgWithMembers[]) ?? []
    })

    let sent = 0
    let checked = 0

    for (const org of orgs) {
      for (const m of org.memberships) {
        const email = m.profiles?.email
        if (!email) continue
        checked++
        const isManager = m.role === 'owner' || m.role === 'admin'

        await step.run(`send-digest-${org.id}-${m.user_id}`, async () => {
          try {
            const data = await buildDigestData(admin, org.id, org.niche, isManager ? null : m.user_id)
            const totalItems = data.overdueTasks.length + data.todayTasks.length + (data.todayTrips?.length ?? 0) + (data.weekTrips?.length ?? 0)
            const subject = data.overdueTasks.length > 0
              ? `⚠️ ${data.overdueTasks.length} tarefa(s) em atraso — resumo de hoje`
              : `☀️ Seu resumo de hoje — ${totalItems} item(ns)`

            await resend.emails.send({
              from: EMAIL_FROM,
              to: email,
              subject,
              html: buildDigestHtml(org.name, org.slug, data, isManager ? 'org' : 'me'),
            })
            sent++
          } catch (err) {
            console.error(`[daily-digest] failed for org ${org.id} / member ${m.user_id}:`, err)
          }
        })
      }
    }

    return { sent, checked }
  }
)
