'use server'

/**
 * Campaign CRUD, metric recording, and syncing from Meta Ads. Split out
 * of marketing.ts.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization, isImpersonating } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { periodStart, type MarketingPeriod } from '@/lib/marketing/period'

const campaignInput = z.object({
  ad_account_id: z.string().uuid(),
  name: z.string().min(2),
  objective: z.string().optional().nullable(),
  utm_campaign: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  started_at: z.string().optional().nullable(),
  ended_at: z.string().optional().nullable(),
  external_id: z.string().optional().nullable(),
})

export async function listCampaigns(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'marketing')
  if (!perm.allowed) return []
  const supabase = createClient()
  const { data } = await supabase
    .from('campaigns')
    .select(
      'id, ad_account_id, name, objective, status, utm_campaign, color, started_at, ended_at, external_id, created_at, ad_accounts(name, provider)',
    )
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })
  return data || []
}

export async function createCampaign(orgSlug: string, raw: unknown) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'marketing')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  const supabase = createClient()

  const parsed = campaignInput.safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message }

  const { data, error } = await supabase
    .from('campaigns')
    .insert({
      organization_id: org.id,
      ad_account_id: parsed.data.ad_account_id,
      name: parsed.data.name,
      objective: parsed.data.objective || null,
      utm_campaign: parsed.data.utm_campaign || null,
      color: parsed.data.color || '#3b82f6',
      started_at: parsed.data.started_at || null,
      ended_at: parsed.data.ended_at || null,
      external_id: parsed.data.external_id || null,
      status: 'active',
    })
    .select('id')
    .maybeSingle()

  if (error || !data) {
    console.error('createCampaign error:', error)
    return { ok: false as const, error: error?.message || 'Erro ao criar campanha' }
  }
  revalidatePath(`/app/${orgSlug}/marketing`)
  return { ok: true as const, id: data.id }
}

export async function updateCampaign(orgSlug: string, id: string, raw: unknown) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'marketing')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  const supabase = createClient()
  const parsed = campaignInput.partial().extend({ status: z.string().optional() }).safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message }

  const { error } = await supabase
    .from('campaigns')
    .update(parsed.data)
    .eq('id', id)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/marketing`)
  return { ok: true as const }
}

export async function deleteCampaign(orgSlug: string, id: string) {
  if (isImpersonating()) {
    return { ok: false as const, error: 'Ações destrutivas não são permitidas em modo de impersonação.' }
  }
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'marketing')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  const supabase = createClient()

  const { error } = await supabase
    .from('campaigns')
    .delete()
    .eq('id', id)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/marketing`)
  return { ok: true as const }
}

/* -------- Metrics (daily entries) -------- */

const metricInput = z.object({
  campaign_id: z.string().uuid(),
  date: z.string(), // YYYY-MM-DD
  impressions: z.coerce.number().int().min(0).optional(),
  clicks: z.coerce.number().int().min(0).optional(),
  spend_cents: z.coerce.number().int().min(0).optional(),
  source: z.enum(['manual', 'csv', 'api']).optional(),
})

/**
 * Upsert a single daily metric row. Used both by manual entry and CSV import
 * (the `source` field discriminates), so re-uploading a CSV updates rather
 * than duplicates. UNIQUE (campaign_id, date, source) enforces the contract
 * in the DB; this function handles the conflict gracefully.
 */
export async function recordCampaignMetric(orgSlug: string, raw: unknown) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'marketing')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  const supabase = createClient()

  const parsed = metricInput.safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message }

  // Make sure the campaign belongs to the caller's org (defense in depth).
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id')
    .eq('id', parsed.data.campaign_id)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!campaign) return { ok: false as const, error: 'Campanha não encontrada' }

  const source = parsed.data.source || 'manual'

  const { error } = await supabase
    .from('campaign_metrics_daily')
    .upsert(
      {
        organization_id: org.id,
        campaign_id: parsed.data.campaign_id,
        date: parsed.data.date,
        impressions: parsed.data.impressions || 0,
        clicks: parsed.data.clicks || 0,
        spend_cents: parsed.data.spend_cents || 0,
        source,
      },
      { onConflict: 'campaign_id,date,source' },
    )

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/marketing`)
  return { ok: true as const }
}

/**
 * Puxa campanhas + métricas diárias (últimos 30 dias) de uma conta de
 * anúncios Meta via Marketing API (read-only, mesmo token do CAPI) e grava
 * em campaigns/campaign_metrics_daily (source='api'). Campanhas já
 * existentes (por external_id) são atualizadas, não duplicadas.
 */
export async function syncAdAccountCampaigns(orgSlug: string, adAccountId: string, period: MarketingPeriod = '30d') {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'marketing')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  const supabase = createClient()

  const { data: account } = await supabase
    .from('ad_accounts')
    .select('id, provider, external_id')
    .eq('id', adAccountId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!account) return { ok: false as const, error: 'Conta não encontrada' }
  if (account.provider !== 'meta') return { ok: false as const, error: 'Sincronização automática só disponível para contas Meta por enquanto' }
  if (!account.external_id) return { ok: false as const, error: 'Preencha o ID da conta de anúncios (act_XXXXXXXXX) antes de sincronizar' }

  const { data: orgRow } = await supabase
    .from('organizations')
    .select('meta_ads_access_token')
    .eq('id', org.id)
    .maybeSingle()
  if (!orgRow?.meta_ads_access_token) {
    return { ok: false as const, error: 'Conecte sua conta do Facebook em Campanhas → Contas antes de sincronizar' }
  }

  const { fetchMetaCampaigns, fetchMetaCampaignDailyInsights } = await import('@/lib/meta/ads')

  let metaCampaigns
  try {
    metaCampaigns = await fetchMetaCampaigns(account.external_id, orgRow.meta_ads_access_token)
  } catch (e: any) {
    return { ok: false as const, error: e?.message || 'Falha ao buscar campanhas na Meta' }
  }

  const until = new Date().toISOString().slice(0, 10)
  const since = periodStart(period)

  // A Meta usa ACTIVE/PAUSED/DELETED/ARCHIVED/PENDING_REVIEW/etc — o CRM só
  // aceita active/paused/archived (campaigns_status_check); tudo que não é
  // ACTIVE ou PAUSED cai em 'archived'.
  const mapStatus = (s: string | undefined | null): 'active' | 'paused' | 'archived' => {
    const up = (s || '').toUpperCase()
    if (up === 'ACTIVE') return 'active'
    if (up === 'PAUSED') return 'paused'
    return 'archived'
  }

  let campaignsSynced = 0
  let metricsSynced = 0
  const errors: string[] = []

  for (const mc of metaCampaigns) {
    const { data: localCampaign, error: upsertErr } = await supabase
      .from('campaigns')
      .upsert(
        {
          organization_id: org.id,
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
    if (upsertErr || !localCampaign) {
      errors.push(`${mc.name}: ${upsertErr?.message || 'falha ao salvar campanha'}`)
      continue
    }
    campaignsSynced++

    try {
      const insights = await fetchMetaCampaignDailyInsights(mc.id, orgRow.meta_ads_access_token, since, until)
      for (const row of insights) {
        const { error: metricErr } = await supabase
          .from('campaign_metrics_daily')
          .upsert(
            {
              organization_id: org.id,
              campaign_id: localCampaign.id,
              date: row.date,
              impressions: row.impressions,
              clicks: row.clicks,
              spend_cents: row.spend_cents,
              meta_leads: row.meta_leads,
              meta_messaging_started: row.meta_messaging_started,
              meta_link_clicks: row.meta_link_clicks,
              meta_landing_page_views: row.meta_landing_page_views,
              meta_purchases: row.meta_purchases,
              meta_purchase_value_cents: row.meta_purchase_value_cents,
              source: 'api',
            },
            { onConflict: 'campaign_id,date,source' },
          )
        if (!metricErr) metricsSynced++
      }
    } catch (e: any) {
      errors.push(`${mc.name}: ${e?.message || 'falha ao buscar métricas'}`)
    }
  }

  revalidatePath(`/app/${orgSlug}/marketing`)
  return {
    ok: true as const,
    campaignsSynced,
    metricsSynced,
    error: errors.length ? errors.slice(0, 3).join('; ') : null,
  }
}
