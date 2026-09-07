/**
 * Reatribuição automática por timeout — quando um lead fica tempo demais no
 * primeiro estágio do pipeline sem nenhuma interação registrada
 * (contato_activities, que já mantém contatos.last_activity_at atualizado
 * via trigger de banco), ele sai da carteira do vendedor atual e volta pra
 * fila de distribuição (ver actions/pipeline-distribution.ts). Roda a cada
 * 5 minutos — é a única regra do app com granularidade de minutos, os
 * outros crons de "atraso" são diários.
 */

import { inngest } from './client'
import { createAdminClient } from '@/lib/supabase/server'
import { createNotification } from '@/actions/notifications'
import { pickNextDistributionMember } from '@/actions/pipeline-distribution'

export const pipelineDistributionCronFn = inngest.createFunction(
  {
    id: 'pipeline-distribution-timeout',
    name: 'Distribuição de leads — reatribuição por timeout (a cada 5min)',
    retries: 1,
    triggers: [{ cron: '*/5 * * * *' }],
  },
  async ({ step }: { step: any }) => {
    const admin = createAdminClient()

    const settingsRows: { pipeline_id: string; organization_id: string; first_stage_timeout_minutes: number }[] =
      await step.run('fetch-timeout-settings', async () => {
        const { data } = await admin
          .from('pipeline_distribution_settings')
          .select('pipeline_id, organization_id, first_stage_timeout_minutes')
          .eq('enabled', true)
          .not('first_stage_timeout_minutes', 'is', null)
          .gt('first_stage_timeout_minutes', 0)
        return (data ?? []) as any[]
      })

    if (settingsRows.length === 0) return { reassigned: 0 }

    let reassigned = 0

    for (const s of settingsRows) {
      const result = await step.run(`reassign-pipeline-${s.pipeline_id}`, async () => {
        const { data: firstStage } = await admin
          .from('pipeline_stages')
          .select('id')
          .eq('pipeline_id', s.pipeline_id)
          .order('position', { ascending: true })
          .limit(1)
          .maybeSingle()
        if (!firstStage) return 0

        const cutoff = new Date(Date.now() - s.first_stage_timeout_minutes * 60_000).toISOString()

        const { data: staleLeads } = await admin
          .from('contatos')
          .select('id, name, assigned_to, last_activity_at, created_at')
          .eq('organization_id', s.organization_id)
          .eq('pipeline_id', s.pipeline_id)
          .eq('stage_id', firstStage.id)
          .eq('status', 'lead')
          .not('assigned_to', 'is', null)
          .limit(200)

        let count = 0
        for (const lead of (staleLeads ?? [])) {
          const ref = lead.last_activity_at || lead.created_at
          if (!ref || ref >= cutoff) continue // ainda dentro do prazo

          const nextUserId = await pickNextDistributionMember(admin, s.organization_id, s.pipeline_id, lead.assigned_to)
          if (!nextUserId || nextUserId === lead.assigned_to) continue

          const previousUserId = lead.assigned_to
          await admin.from('contatos').update({ assigned_to: nextUserId }).eq('id', lead.id)

          // Também bump contato_activities → o trigger de banco já atualiza
          // last_activity_at sozinho, resetando o relógio pra essa lead não
          // ser reprocessada de novo na próxima rodada.
          await admin.from('contato_activities').insert({
            contato_id: lead.id,
            organization_id: s.organization_id,
            type: 'lead_reassigned',
            payload: { from: previousUserId, to: nextUserId, reason: 'timeout', timeout_minutes: s.first_stage_timeout_minutes },
            created_by: null,
          })

          const { data: owners } = await admin.from('memberships').select('user_id').eq('organization_id', s.organization_id).eq('role', 'owner')
          const notifyIds = new Set<string>([previousUserId, ...(owners ?? []).map((o: any) => o.user_id)])
          for (const userId of Array.from(notifyIds)) {
            await createNotification({
              organizationId: s.organization_id,
              userId,
              type: 'lead_reassigned',
              title: `Lead reatribuído por falta de resposta`,
              content: `"${lead.name || 'Lead'}" ficou ${s.first_stage_timeout_minutes}min sem interação no primeiro estágio e foi reatribuído.`,
            })
          }

          count++
        }
        return count
      })

      reassigned += result
    }

    return { reassigned }
  }
)
