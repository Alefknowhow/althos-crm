/**
 * Lembrete automático de renovação de apólice (Vertical Seguros, Fase 4)
 * — roda diariamente, procura apólices ativas cujo `end_date` bate
 * exatamente com um dos thresholds configurados pela org
 * (`org_settings.insurance_renewal_reminder_days`, default
 * {60,30,15}), cria uma tarefa pro corretor e emite
 * `seguros.policy.renewal_due` pro motor de automação genérico
 * (que manda WhatsApp se a agência configurar — mesmo padrão de
 * `imoveis.visit.scheduled`, sem lógica de WhatsApp duplicada aqui).
 *
 * Idempotência: cada apólice guarda em `renewal_reminder_days_sent`
 * quais thresholds já geraram tarefa — nunca duplica no mesmo dia
 * nem em execuções futuras pro mesmo threshold.
 */

import { inngest } from './client'
import { createAdminClient } from '@/lib/supabase/server'
import { isInsuranceNiche } from '@/lib/niche'

export const insuranceRenewalReminderCronFn = inngest.createFunction(
  {
    id:      'insurance-renewal-reminder',
    name:    'Seguros: lembrete de renovação de apólice',
    retries: 1,
    triggers: [{ cron: '0 8 * * *' }],
  },
  async ({ step }: { step: any }) => {
    const admin = createAdminClient()

    const orgs: Array<{ id: string; niche: string | null }> = await step.run('fetch-insurance-orgs', async () => {
      const { data } = await admin.from('organizations').select('id, niche')
      return (data || []).filter((o: any) => isInsuranceNiche(o.niche))
    })
    if (orgs.length === 0) return { created: 0 }
    const orgIds = orgs.map(o => o.id)

    const settingsRows: Array<{ org_id: string; insurance_renewal_reminder_days: number[] }> = await step.run('fetch-settings', async () => {
      const { data } = await admin
        .from('org_settings')
        .select('org_id, insurance_renewal_reminder_days')
        .in('org_id', orgIds)
      return data || []
    })
    const thresholdsByOrg = new Map(settingsRows.map(s => [s.org_id, s.insurance_renewal_reminder_days || [60, 30, 15]]))

    const policies: Array<{
      id: string; organization_id: string; contato_id: string; policy_number: string | null
      end_date: string | null; broker_user_id: string | null; created_by: string | null
      renewal_reminder_days_sent: number[]
    }> = await step.run('fetch-active-policies', async () => {
      const { data } = await admin
        .from('insurance_policies')
        .select('id, organization_id, contato_id, policy_number, end_date, broker_user_id, created_by, renewal_reminder_days_sent')
        .in('organization_id', orgIds)
        .eq('status', 'ativa')
        .not('end_date', 'is', null)
      return data || []
    })
    if (policies.length === 0) return { created: 0 }

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    let created = 0
    for (const policy of policies) {
      const thresholds = thresholdsByOrg.get(policy.organization_id) || [60, 30, 15]
      const end = new Date(policy.end_date as string)
      const daysRemaining = Math.round((end.getTime() - today.getTime()) / 86_400_000)
      if (!thresholds.includes(daysRemaining)) continue
      if ((policy.renewal_reminder_days_sent || []).includes(daysRemaining)) continue

      await step.run(`renewal-task-${policy.id}-${daysRemaining}`, async () => {
        const { data: contato } = await admin.from('contatos').select('name').eq('id', policy.contato_id).maybeSingle()
        const { data: column } = await admin
          .from('task_columns')
          .select('id')
          .eq('organization_id', policy.organization_id)
          .order('position', { ascending: true })
          .limit(1)
          .maybeSingle()

        await admin.from('tasks').insert({
          organization_id: policy.organization_id, contato_id: policy.contato_id,
          title: `Renovação: ${contato?.name || 'cliente'} — apólice ${policy.policy_number || ''} vence em ${daysRemaining} dias`,
          due_date: today.toISOString().slice(0, 10), priority: 'normal', status: 'open',
          assigned_to: policy.broker_user_id || policy.created_by, column_id: column?.id ?? null,
        })

        await inngest.send({
          name: 'seguros.policy.renewal_due',
          data: { orgId: policy.organization_id, leadId: policy.contato_id, policyId: policy.id, daysRemaining },
        })

        await admin
          .from('insurance_policies')
          .update({ renewal_reminder_days_sent: [...(policy.renewal_reminder_days_sent || []), daysRemaining] })
          .eq('id', policy.id)
      })
      created++
    }

    return { created }
  },
)
