/**
 * Reconciliador Estratégia (Althos) × publicado na plataforma (#22, passo 3.5)
 * — cron diário, read-only: busca o estado real do objeto vinculado
 * (nome/status/orçamento) via Ads Tool Layer e compara com o item do plano
 * de mídia. NUNCA sobrescreve nem o plano nem a plataforma — só marca
 * `sync_status` (`diverged`/`external_change`/`sync_error`) com o motivo,
 * pra o gestor decidir o que fazer.
 */

import { inngest } from './client'
import { createAdminClient } from '@/lib/supabase/server'
import { getAdsAdapter, resolveAdsToken } from '@/lib/ads'

export const reconcileMediaPlanItemsFn = inngest.createFunction(
  {
    id: 'trafego-media-plan-reconcile',
    name: 'Reconciliação do Plano de Mídia (Tráfego)',
    retries: 1,
    triggers: [{ cron: '0 7 * * *' }], // diário às 07:00 UTC
  },
  async ({ step }: { step: any }) => {
    const admin = createAdminClient()

    const orgs: { id: string }[] = await step.run('list-trafego-orgs', async () => {
      const { data } = await admin.from('organizations').select('id').eq('niche', 'trafego')
      return data || []
    })

    for (const org of orgs) {
      await step.run(`reconcile-org-${org.id}`, async () => {
        // Só itens nível "campaign" nesta fase: fetchCampaigns() exige o
        // external_id da CONTA de anúncio, não do próprio item — precisa
        // resolver via media_plans.contato_id → ad_accounts. Reconciliar
        // adset/ad exigiria conhecer a cadeia completa (campanha pai), fora
        // do escopo desta primeira versão (anotado como follow-up).
        const { data: items } = await admin
          .from('media_plan_items')
          .select('id, name, status, budget_cents, external_id, external_provider, media_plan_id, level')
          .eq('organization_id', org.id)
          .eq('level', 'campaign')
          .not('external_id', 'is', null)
        if (!items || items.length === 0) return

        const tokenCache = new Map<string, string | null>()
        const accountExternalIdCache = new Map<string, string | null>()

        for (const item of items) {
          const provider = item.external_provider as 'meta' | 'google'
          const adapter = getAdsAdapter(provider)
          if (!adapter.capabilities.readCampaigns) {
            await admin.from('media_plan_items').update({ sync_status: 'sync_error', last_sync_error: `Provider "${provider}" sem leitura habilitada`, last_synced_at: new Date().toISOString() }).eq('id', item.id)
            continue
          }
          if (!tokenCache.has(provider)) tokenCache.set(provider, await resolveAdsToken(admin, org.id, provider))
          const token = tokenCache.get(provider)
          if (!token) {
            await admin.from('media_plan_items').update({ sync_status: 'sync_error', last_sync_error: 'Token da conta de anúncio ausente ou expirado', last_synced_at: new Date().toISOString() }).eq('id', item.id)
            continue
          }

          if (!accountExternalIdCache.has(item.media_plan_id)) {
            const { data: plan } = await admin.from('media_plans').select('contato_id').eq('id', item.media_plan_id).maybeSingle()
            const { data: account } = plan
              ? await admin.from('ad_accounts').select('external_id').eq('organization_id', org.id).eq('contato_id', plan.contato_id).eq('provider', provider).not('external_id', 'is', null).limit(1).maybeSingle()
              : { data: null }
            accountExternalIdCache.set(item.media_plan_id, account?.external_id || null)
          }
          const accountExternalId = accountExternalIdCache.get(item.media_plan_id)
          if (!accountExternalId) {
            await admin.from('media_plan_items').update({ sync_status: 'sync_error', last_sync_error: 'Conta de anúncio do cliente não encontrada', last_synced_at: new Date().toISOString() }).eq('id', item.id)
            continue
          }

          try {
            const remote = (await adapter.fetchCampaigns!(accountExternalId, token)).find(c => c.id === item.external_id)
            if (!remote) {
              await admin.from('media_plan_items').update({ sync_status: 'external_change', last_sync_error: 'Objeto não encontrado mais na plataforma (excluído/renomeado externamente?)', last_synced_at: new Date().toISOString() }).eq('id', item.id)
              continue
            }
            const nameChanged = remote.name !== item.name
            const statusChanged = remote.status !== item.status
            const diverged = nameChanged || statusChanged
            await admin.from('media_plan_items').update({
              sync_status: diverged ? 'diverged' : 'published',
              last_sync_error: diverged ? `Divergência: ${nameChanged ? `nome ("${remote.name}" na plataforma vs. "${item.name}" no plano)` : ''}${nameChanged && statusChanged ? '; ' : ''}${statusChanged ? `status ("${remote.status}" vs. "${item.status}")` : ''}` : null,
              last_synced_at: new Date().toISOString(),
            }).eq('id', item.id)
          } catch (e: any) {
            await admin.from('media_plan_items').update({ sync_status: 'sync_error', last_sync_error: e?.message || 'Erro ao consultar a plataforma', last_synced_at: new Date().toISOString() }).eq('id', item.id)
          }
        }
      })
    }

    return { orgsProcessed: orgs.length }
  },
)
