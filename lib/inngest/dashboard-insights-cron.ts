/**
 * Insights automáticos da Inicial: detecções por regra/threshold, SEM
 * chamar IA (o painel só lê o que este job já pré-computou — nenhum crédito
 * é gasto no render). Roda a cada 4h, uma passada por organização.
 *
 * Três detecções, deliberadamente simples e determinísticas:
 *   1. Risco: leads presos há mais de 7 dias sem nenhuma atualização.
 *   2. Variação: leads novos dos últimos 7 dias vs. os 7 anteriores.
 *   3. Variação: receita realizada dos últimos 7 dias vs. os 7 anteriores.
 */

import { inngest } from './client'
import { createAdminClient } from '@/lib/supabase/server'
import { fetchNormalizedSales } from '@/lib/dashboard/sales-source'

const DAY = 86_400_000

async function detectStaleLeads(admin: ReturnType<typeof createAdminClient>, orgId: string) {
  const { data: pipelines } = await admin.from('pipelines').select('id').eq('organization_id', orgId)
  const pipelineIds = (pipelines || []).map(p => p.id)
  if (pipelineIds.length === 0) return null

  const { data: closedStages } = await admin
    .from('pipeline_stages')
    .select('id')
    .in('pipeline_id', pipelineIds)
    .ilike('name', '%fechado%')
  const closedIds = (closedStages || []).map(s => s.id)

  const staleCutoff = new Date(Date.now() - 7 * DAY).toISOString()
  let q = admin
    .from('contatos')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('status', 'lead')
    .not('stage_id', 'is', null)
    .lt('updated_at', staleCutoff)
  if (closedIds.length > 0) q = q.not('stage_id', 'in', `(${closedIds.join(',')})`)

  const { count } = await q
  if (!count || count === 0) return null

  return {
    kind: 'risk' as const,
    icon: 'alert-triangle',
    text: `${count} lead${count !== 1 ? 's' : ''} sem atualização há mais de 7 dias.`,
    deep_link: '/pipeline',
    score: Math.min(100, count * 5),
  }
}

async function detectLeadsChange(admin: ReturnType<typeof createAdminClient>, orgId: string) {
  const now = new Date()
  const start7 = new Date(now.getTime() - 7 * DAY)
  const prevStart = new Date(start7.getTime() - 7 * DAY)

  const { count: last7 } = await admin
    .from('contatos')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .gte('created_at', start7.toISOString())
  const { count: prev7 } = await admin
    .from('contatos')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .gte('created_at', prevStart.toISOString())
    .lt('created_at', start7.toISOString())

  if (!prev7 || prev7 < 5) return null // amostra pequena demais pra confiar na variação

  const change = (((last7 || 0) - prev7) / prev7) * 100
  if (change <= -30) {
    return {
      kind: 'risk' as const,
      icon: 'trending-down',
      text: `Leads novos caíram ${Math.abs(change).toFixed(0)}% na última semana.`,
      deep_link: '/',
      score: Math.min(100, Math.abs(change)),
    }
  }
  if (change >= 50) {
    return {
      kind: 'opportunity' as const,
      icon: 'trending-up',
      text: `Leads novos subiram ${change.toFixed(0)}% na última semana.`,
      deep_link: '/',
      score: Math.min(100, change),
    }
  }
  return null
}

async function detectRevenueChange(admin: ReturnType<typeof createAdminClient>, orgId: string) {
  const now = new Date()
  const start7 = new Date(now.getTime() - 7 * DAY)
  const prevStart = new Date(start7.getTime() - 7 * DAY)

  const [last7Sales, prev7Sales] = await Promise.all([
    fetchNormalizedSales(admin as any, orgId, { since: start7, onlyCompleted: true }),
    fetchNormalizedSales(admin as any, orgId, { since: prevStart, onlyCompleted: true }),
  ])
  const last7 = last7Sales.reduce((a, s) => a + s.amount_cents, 0)
  const prevWindow = prev7Sales
    .filter(s => new Date(s.date) < start7)
    .reduce((a, s) => a + s.amount_cents, 0)

  if (prevWindow < 10_000) return null // menos de R$100 na semana anterior — sem base de comparação

  const change = ((last7 - prevWindow) / prevWindow) * 100
  if (change <= -40) {
    return {
      kind: 'risk' as const,
      icon: 'trending-down',
      text: `Receita realizada caiu ${Math.abs(change).toFixed(0)}% na última semana.`,
      deep_link: '/',
      score: Math.min(100, Math.abs(change)),
    }
  }
  if (change >= 60) {
    return {
      kind: 'opportunity' as const,
      icon: 'trending-up',
      text: `Receita realizada subiu ${change.toFixed(0)}% na última semana.`,
      deep_link: '/',
      score: Math.min(100, change),
    }
  }
  return null
}

export const dashboardInsightsCronFn = inngest.createFunction(
  {
    id: 'dashboard-insights-cron',
    name: 'Inicial: insights automáticos',
    retries: 1,
    triggers: [{ cron: '0 */4 * * *' }],
  },
  async ({ step }: { step: any }) => {
    const admin = createAdminClient()

    const orgs: { id: string }[] = await step.run('fetch-orgs', async () => {
      const { data } = await admin.from('organizations').select('id')
      return data || []
    })

    let created = 0

    for (const org of orgs) {
      await step.run(`insights-${org.id}`, async () => {
        const results = await Promise.all([
          detectStaleLeads(admin, org.id),
          detectLeadsChange(admin, org.id),
          detectRevenueChange(admin, org.id),
        ])
        const rows = results.filter((r): r is NonNullable<typeof r> => !!r)

        // Renova a cada rodada: os insights são uma camada "ao vivo", não um
        // histórico — limpa os não-dispensados da org antes de inserir os
        // novos, senão a mesma condição geraria um chip duplicado a cada 4h.
        await admin
          .from('dashboard_insights')
          .delete()
          .eq('organization_id', org.id)
          .is('dismissed_at', null)

        if (rows.length === 0) return
        await admin.from('dashboard_insights').insert(
          rows.map(r => ({ organization_id: org.id, ...r })),
        )
        created += rows.length
      })
    }

    return { orgsProcessed: orgs.length, insightsCreated: created }
  },
)
