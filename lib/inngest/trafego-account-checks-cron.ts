/**
 * "Analisar contas" — operação diária (#22, passo 3.6). Pra cada cliente
 * com conta de anúncio ativa numa org do nicho tráfego, calcula
 * health/alertas (mesma regra determinística do painel — sem IA aqui,
 * custo/créditos ficam só pro chat sob demanda do Traffic Agent) e guarda
 * o snapshot em traffic_account_checks. Se crítico/atenção, notifica os
 * responsáveis (assigned_to do cliente, se houver, senão a org toda).
 */

import { inngest } from './client'
import { createAdminClient } from '@/lib/supabase/server'
import { getClientPerformanceSummaryCore } from '@/actions/trafego-performance'
import { computeClientAlerts } from '@/lib/trafego/alerts'
import { computeClientHealthStatus } from '@/lib/trafego/health-status'
import { createNotification } from '@/actions/notifications'

export const trafegoAccountChecksCronFn = inngest.createFunction(
  {
    id: 'trafego-account-checks-cron',
    name: 'Análise diária de contas (Tráfego)',
    retries: 1,
    triggers: [{ cron: '0 8 * * *' }], // diário às 08:00 UTC
  },
  async ({ step }: { step: any }) => {
    const admin = createAdminClient()
    const today = new Date().toISOString().slice(0, 10)

    const orgs: { id: string }[] = await step.run('list-trafego-orgs', async () => {
      const { data } = await admin.from('organizations').select('id').eq('niche', 'trafego')
      return data || []
    })

    let checked = 0
    for (const org of orgs) {
      checked += await step.run(`check-org-${org.id}`, async () => {
        const { data: clients } = await admin
          .from('contatos')
          .select('id, name, assigned_to')
          .eq('organization_id', org.id)
          .eq('status', 'cliente')
        if (!clients || clients.length === 0) return 0

        const { data: accounts } = await admin.from('ad_accounts').select('contato_id').eq('organization_id', org.id)
        const clientsWithAccount = new Set((accounts || []).map(a => a.contato_id))

        const now = new Date()
        const range = { from: new Date(now.getTime() - 29 * 86_400_000), to: now }
        const prevRange = { from: new Date(range.from.getTime() - 30 * 86_400_000), to: new Date(range.from.getTime() - 1) }

        let count = 0
        for (const client of clients) {
          if (!clientsWithAccount.has(client.id)) continue
          const [current, previous, { data: contatoRow }] = await Promise.all([
            getClientPerformanceSummaryCore(admin, org.id, client.id, range),
            getClientPerformanceSummaryCore(admin, org.id, client.id, prevRange),
            admin.from('contatos').select('traffic_client_profile').eq('id', client.id).maybeSingle(),
          ])
          const profile = (contatoRow as any)?.traffic_client_profile ?? null
          const alerts = computeClientAlerts(current, previous, profile, null)
          const health = computeClientHealthStatus({
            investmentCents: current.investmentCents,
            cplCents: current.cplCents,
            targetCpl: profile?.targetCpl ?? null,
            roas: current.roas,
            targetRoas: profile?.targetRoas ?? null,
          })

          await admin.from('traffic_account_checks').upsert(
            { organization_id: org.id, contato_id: client.id, check_date: today, health, alerts },
            { onConflict: 'organization_id,contato_id,check_date' },
          )
          count++

          if (health === 'critico' || health === 'atencao') {
            await createNotification({
              organizationId: org.id,
              userId: client.assigned_to || null,
              type: 'trafego_account_check',
              title: `${health === 'critico' ? 'Crítico' : 'Atenção'}: ${client.name}`,
              content: alerts[0]?.reason || 'Verifique a operação deste cliente.',
              link: `/agencias-trafego/trafego/${client.id}`,
            })
          }
        }
        return count
      })
    }

    return { orgsProcessed: orgs.length, clientsChecked: checked }
  },
)
