/**
 * Sincronização diária (automática) de campanhas + métricas da Meta Marketing
 * API pra todas as contas de anúncios Meta cadastradas com external_id — sem
 * precisar clicar em "Sincronizar" manualmente. Reaproveita a mesma lógica do
 * botão manual (fetchMetaCampaigns/fetchMetaCampaignDailyInsights), só que
 * iterando por todas as organizações que tenham token configurado.
 */

import { inngest } from './client'
import { createAdminClient } from '@/lib/supabase/server'
import { fetchMetaCampaigns, fetchMetaCampaignDailyInsights } from '@/lib/meta/ads'

function mapStatus(s: string | undefined | null): 'active' | 'paused' | 'archived' {
  const up = (s || '').toUpperCase()
  if (up === 'ACTIVE') return 'active'
  if (up === 'PAUSED') return 'paused'
  return 'archived'
}

export const marketingSyncCronFn = inngest.createFunction(
  {
    id: 'marketing-sync-meta-campaigns',
    name: 'Marketing: sincronizar campanhas Meta',
    retries: 1,
    triggers: [{ cron: '0 6 * * *' }], // diariamente às 6h
  },
  async ({ step }: { step: any }) => {
    const admin = createAdminClient()

    const accounts: Array<{ id: string; organization_id: string; external_id: string }> =
      await step.run('fetch-meta-accounts', async () => {
        const { data } = await admin
          .from('ad_accounts')
          .select('id, organization_id, external_id')
          .eq('provider', 'meta')
          .eq('status', 'active')
          .not('external_id', 'is', null)
        return data || []
      })

    if (accounts.length === 0) return { synced: 0 }

    const orgIds = Array.from(new Set(accounts.map(a => a.organization_id)))
    const tokenByOrg: [string, string][] = await step.run('fetch-org-tokens', async () => {
      const { data } = await admin
        .from('organizations')
        .select('id, meta_ads_access_token')
        .in('id', orgIds)
      const pairs: [string, string][] = []
      for (const o of data || []) if (o.meta_ads_access_token) pairs.push([o.id as string, o.meta_ads_access_token as string])
      return pairs
    })
    const tokens = new Map<string, string>(tokenByOrg)

    const until = new Date().toISOString().slice(0, 10)
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10)

    let synced = 0
    for (const account of accounts) {
      const token = tokens.get(account.organization_id)
      if (!token) continue

      await step.run(`sync-account-${account.id}`, async () => {
        try {
          const campaigns = await fetchMetaCampaigns(account.external_id, token)
          for (const mc of campaigns) {
            const { data: localCampaign } = await admin
              .from('campaigns')
              .upsert(
                {
                  organization_id: account.organization_id,
                  ad_account_id: account.id,
                  external_id: mc.id,
                  name: mc.name,
                  objective: mc.objective || null,
                  status: mapStatus(mc.status),
                  started_at: mc.start_time ? mc.start_time.slice(0, 10) : null,
                  ended_at: mc.stop_time ? mc.stop_time.slice(0, 10) : null,
                },
                { onConflict: 'ad_account_id,external_id' },
              )
              .select('id')
              .maybeSingle()
            if (!localCampaign) continue

            const insights = await fetchMetaCampaignDailyInsights(mc.id, token, since, until)
            for (const row of insights) {
              await admin.from('campaign_metrics_daily').upsert(
                {
                  organization_id: account.organization_id,
                  campaign_id: localCampaign.id,
                  date: row.date,
                  impressions: row.impressions,
                  clicks: row.clicks,
                  spend_cents: row.spend_cents,
                  source: 'api',
                },
                { onConflict: 'campaign_id,date,source' },
              )
            }
          }
        } catch (e: any) {
          console.error(`[marketing-sync] account ${account.id} failed:`, e?.message)
        }
      })
      synced++
    }

    return { synced }
  },
)
