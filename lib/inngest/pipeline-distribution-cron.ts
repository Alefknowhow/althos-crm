/**
 * Reatribuição automática por timeout — quando um lead fica tempo demais num
 * estágio configurado sem nenhuma interação registrada (contato_activities,
 * que já mantém contatos.last_activity_at atualizado via trigger de banco),
 * ele sai da carteira do vendedor atual e volta pra fila de distribuição
 * (ver actions/pipeline-distribution.ts). Roda a cada 5 minutos — é a única
 * regra do app com granularidade de minutos, os outros crons de "atraso"
 * são diários.
 *
 * Feature com toggle próprio (pipeline_distribution_settings.reassignment_enabled,
 * default false) e N regras por pipeline (pipeline_reassignment_rules: 1
 * estágio + 1 timeout cada) — ver migration 0225. Pensado pro fluxo onde o
 * 1º estágio é tratado pelo Agente IA e só cai pro humano depois — cada
 * estágio pode ter seu próprio prazo de tolerância.
 *
 * Reescrito (2026-09) por achado de performance: o corpo do loop de leads
 * era inteiramente sequencial (pickNextDistributionMember + update + insert
 * de atividade + select de owners + notificações, um lead por vez, sem
 * Promise.all) — com uma fila grande isso arriscava ultrapassar os 5min até
 * a próxima execução. Agora: owners são buscados 1x por org (não por lead),
 * e o processamento de cada lead roda em paralelo via Promise.all.
 */

import { inngest } from './client'
import { createAdminClient } from '@/lib/supabase/server'
import { createNotification } from '@/actions/notifications'
import { pickNextDistributionMember } from '@/actions/pipeline-distribution'

type ReassignmentRule = { id: string; organization_id: string; pipeline_id: string; stage_id: string; timeout_minutes: number }

export const pipelineDistributionCronFn = inngest.createFunction(
  {
    id: 'pipeline-distribution-timeout',
    name: 'Distribuição de leads — reatribuição por timeout (a cada 5min)',
    retries: 1,
    triggers: [{ cron: '*/5 * * * *' }],
  },
  async ({ step }: { step: any }) => {
    const admin = createAdminClient()

    const rules: ReassignmentRule[] = await step.run('fetch-reassignment-rules', async () => {
      const { data: enabledSettings } = await admin
        .from('pipeline_distribution_settings')
        .select('pipeline_id')
        .eq('reassignment_enabled', true)
      const pipelineIds = (enabledSettings ?? []).map((s: any) => s.pipeline_id)
      if (pipelineIds.length === 0) return []

      const { data } = await admin
        .from('pipeline_reassignment_rules')
        .select('id, organization_id, pipeline_id, stage_id, timeout_minutes')
        .in('pipeline_id', pipelineIds)
      return (data ?? []) as ReassignmentRule[]
    })

    if (rules.length === 0) return { reassigned: 0 }

    // Owners só precisam ser buscados 1x por organização (não muda por
    // lead/regra) — antes era 1 select por lead reatribuído.
    const ownersByOrg = new Map<string, string[]>()
    async function getOwnerIds(orgId: string): Promise<string[]> {
      if (ownersByOrg.has(orgId)) return ownersByOrg.get(orgId)!
      const { data } = await admin.from('memberships').select('user_id').eq('organization_id', orgId).eq('role', 'owner')
      const ids = (data ?? []).map((o: any) => o.user_id as string)
      ownersByOrg.set(orgId, ids)
      return ids
    }

    let reassigned = 0

    for (const rule of rules) {
      const count = await step.run(`reassign-rule-${rule.id}`, async () => {
        const cutoff = new Date(Date.now() - rule.timeout_minutes * 60_000).toISOString()

        const { data: staleLeads } = await admin
          .from('contatos')
          .select('id, name, assigned_to, last_activity_at, created_at')
          .eq('organization_id', rule.organization_id)
          .eq('pipeline_id', rule.pipeline_id)
          .eq('stage_id', rule.stage_id)
          .eq('status', 'lead')
          .not('assigned_to', 'is', null)
          .limit(200)

        const candidates = (staleLeads ?? []).filter(lead => {
          const ref = lead.last_activity_at || lead.created_at
          return ref && ref < cutoff
        })
        if (candidates.length === 0) return 0

        const ownerIds = await getOwnerIds(rule.organization_id)

        const results = await Promise.all(candidates.map(async (lead) => {
          const nextUserId = await pickNextDistributionMember(admin, rule.organization_id, rule.pipeline_id, lead.assigned_to)
          if (!nextUserId || nextUserId === lead.assigned_to) return false

          const previousUserId = lead.assigned_to

          await Promise.all([
            admin.from('contatos').update({ assigned_to: nextUserId }).eq('id', lead.id),
            admin.from('contato_activities').insert({
              contato_id: lead.id,
              organization_id: rule.organization_id,
              type: 'lead_reassigned',
              payload: { from: previousUserId, to: nextUserId, reason: 'timeout', timeout_minutes: rule.timeout_minutes },
              created_by: null,
            }),
          ])

          const notifyIds = new Set<string>([previousUserId, ...ownerIds])
          await Promise.all(Array.from(notifyIds).map(userId => createNotification({
            organizationId: rule.organization_id,
            userId,
            type: 'lead_reassigned',
            title: `Lead reatribuído por falta de resposta`,
            content: `"${lead.name || 'Lead'}" ficou ${rule.timeout_minutes}min sem interação e foi reatribuído.`,
          })))

          return true
        }))

        return results.filter(Boolean).length
      })

      reassigned += count
    }

    return { reassigned }
  }
)
