'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization, isImpersonating } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { classifyObjective, type ObjectiveGroup } from '@/lib/marketing/objective'

/* -------- Types -------- */

export type Provider = 'meta' | 'google' | 'tiktok' | 'other'

/* -------- Ad Accounts CRUD -------- */

const adAccountInput = z.object({
  provider: z.enum(['meta', 'google', 'tiktok', 'other']),
  name: z.string().min(2),
  external_id: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  /** Agências de Tráfego — vincula a conta a um cliente (contatos.id). */
  contato_id: z.string().uuid().optional().nullable(),
})

export async function listAdAccounts(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'marketing')
  if (!perm.allowed) return []
  const supabase = createClient()
  const { data } = await supabase
    .from('ad_accounts')
    .select('id, provider, name, external_id, status, notes, contato_id, created_at')
    .eq('organization_id', org.id)
    .order('created_at', { ascending: true })
  return data || []
}

/** Agências de Tráfego — contas de anúncio vinculadas a um cliente específico. */
export async function listAdAccountsByClient(orgSlug: string, contatoId: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'trafego')
  if (!perm.allowed) return []
  const supabase = createClient()
  const { data } = await supabase
    .from('ad_accounts')
    .select('id, provider, name, external_id, status, notes, created_at, updated_at')
    .eq('organization_id', org.id)
    .eq('contato_id', contatoId)
    .order('created_at', { ascending: true })
  return data || []
}

/**
 * Agências de Tráfego — campanhas + gasto/impressões/cliques dos últimos
 * `days` dias, só das contas vinculadas ao cliente. Reaproveita
 * campaign_metrics_daily já usada por getMarketingOverview.
 *
 * Núcleo sem auth (recebe orgId já resolvido) — usado tanto pela action
 * pública (session cookie) quanto pelas tools do Agent Layer (token,
 * lib/agent/tools/campaigns.ts), que não têm cookie de sessão pra passar
 * por requireAuth()/getCurrentOrganization().
 */
export async function listCampaignsByClientCore(supabase: ReturnType<typeof createClient>, orgId: string, contatoId: string, days = 30) {
  const { data: accounts } = await supabase
    .from('ad_accounts')
    .select('id')
    .eq('organization_id', orgId)
    .eq('contato_id', contatoId)
  const accountIds = (accounts || []).map(a => a.id)
  if (accountIds.length === 0) return []

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, objective, status, started_at, ended_at, ad_account_id, ad_accounts(name, provider)')
    .eq('organization_id', orgId)
    .in('ad_account_id', accountIds)
    .order('created_at', { ascending: false })
  if (!campaigns || campaigns.length === 0) return []

  const since = new Date()
  since.setDate(since.getDate() - days)
  const { data: metrics } = await supabase
    .from('campaign_metrics_daily')
    .select('campaign_id, impressions, clicks, spend_cents, meta_leads')
    .eq('organization_id', orgId)
    .in('campaign_id', campaigns.map(c => c.id))
    .gte('date', since.toISOString().slice(0, 10))

  const totals = new Map<string, { impressions: number; clicks: number; spend_cents: number; leads: number }>()
  for (const m of metrics || []) {
    const cur = totals.get(m.campaign_id) || { impressions: 0, clicks: 0, spend_cents: 0, leads: 0 }
    cur.impressions += m.impressions || 0
    cur.clicks += m.clicks || 0
    cur.spend_cents += m.spend_cents || 0
    cur.leads += (m as any).meta_leads || 0
    totals.set(m.campaign_id, cur)
  }

  return campaigns.map(c => ({
    ...c,
    metrics: totals.get(c.id) || { impressions: 0, clicks: 0, spend_cents: 0, leads: 0 },
  }))
}

export async function listCampaignsByClient(orgSlug: string, contatoId: string, days = 30) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'trafego')
  if (!perm.allowed) return []
  const supabase = createClient()
  return listCampaignsByClientCore(supabase, org.id, contatoId, days)
}

export async function createAdAccount(orgSlug: string, raw: unknown) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'marketing')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  const supabase = createClient()

  const parsed = adAccountInput.safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message }

  const { data, error } = await supabase
    .from('ad_accounts')
    .insert({
      organization_id: org.id,
      provider: parsed.data.provider,
      name: parsed.data.name,
      external_id: parsed.data.external_id || null,
      notes: parsed.data.notes || null,
      contato_id: parsed.data.contato_id || null,
      status: 'active',
    })
    .select('id')
    .maybeSingle()

  if (error || !data) {
    console.error('createAdAccount error:', error)
    return { ok: false as const, error: error?.message || 'Erro ao criar conta' }
  }
  revalidatePath(`/app/${orgSlug}/marketing`)
  return { ok: true as const, id: data.id }
}

export async function updateAdAccount(orgSlug: string, id: string, raw: unknown) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'marketing')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  const supabase = createClient()
  const parsed = adAccountInput.partial().safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message }

  const { error } = await supabase
    .from('ad_accounts')
    .update(parsed.data)
    .eq('id', id)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/marketing`)
  return { ok: true as const }
}

export async function deleteAdAccount(orgSlug: string, id: string) {
  if (isImpersonating()) {
    return { ok: false as const, error: 'Ações destrutivas não são permitidas em modo de impersonação.' }
  }
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'marketing')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  const supabase = createClient()

  const { count } = await supabase
    .from('campaigns')
    .select('id', { count: 'exact', head: true })
    .eq('ad_account_id', id)
    .eq('organization_id', org.id)

  if (count && count > 0) {
    return {
      ok: false as const,
      error: `Conta possui ${count} campanha(s). Remova-as primeiro.`,
    }
  }

  const { error } = await supabase
    .from('ad_accounts')
    .delete()
    .eq('id', id)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/marketing`)
  return { ok: true as const }
}

/* -------- Campaigns CRUD -------- */

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
export async function syncAdAccountCampaigns(orgSlug: string, adAccountId: string) {
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
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10)

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

/**
 * Confirma a conexão via OAuth: lê o token pendente da cookie httpOnly
 * (setada pelo callback em app/api/meta-ads/callback), revalida contra a
 * própria Meta (evita aceitar IDs forjados vindos do client) e grava o
 * token em organizations.meta_ads_access_token + uma ad_accounts por conta
 * selecionada.
 */
export async function connectMetaAdsAccounts(orgSlug: string, selectedAccountIds: string[]) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'marketing')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const cookieStore = cookies()
  const token = cookieStore.get('meta_ads_pending_token')?.value
  const pendingOrg = cookieStore.get('meta_ads_pending_org')?.value
  if (!token || pendingOrg !== orgSlug) {
    return { ok: false as const, error: 'Sessão de conexão expirada, tente conectar novamente' }
  }

  const { listAdAccountsForToken, getLongLivedToken } = await import('@/lib/meta/ads-oauth')
  let available
  try {
    available = await listAdAccountsForToken(token)
  } catch (e: any) {
    return { ok: false as const, error: e?.message || 'Falha ao validar contas de anúncio' }
  }
  const availableIds = new Set(available.map(a => a.id))
  const validSelected = selectedAccountIds.filter(id => availableIds.has(id))
  if (validSelected.length === 0) {
    return { ok: false as const, error: 'Nenhuma conta válida selecionada' }
  }

  const supabase = createClient()
  const expiresAt = new Date(Date.now() + 55 * 24 * 3600 * 1000).toISOString() // ~55 dias
  await supabase
    .from('organizations')
    .update({ meta_ads_access_token: token, meta_ads_token_expires_at: expiresAt })
    .eq('id', org.id)

  let accountsConnected = 0
  for (const accountId of validSelected) {
    const meta = available.find(a => a.id === accountId)
    if (!meta) continue
    const { error } = await supabase
      .from('ad_accounts')
      .upsert(
        { organization_id: org.id, provider: 'meta', name: meta.name, external_id: meta.id, status: 'active' },
        { onConflict: 'organization_id,provider,external_id' },
      )
    if (!error) accountsConnected++
  }

  cookieStore.delete('meta_ads_pending_token')
  cookieStore.delete('meta_ads_pending_org')
  revalidatePath(`/app/${orgSlug}/marketing/contas`)
  return { ok: true as const, accountsConnected }
}

/**
 * Igual connectMetaAdsAccounts, mas vinculando cada conta escolhida ao
 * cliente de tráfego (ad_accounts.contato_id) — usado pelo fluxo OAuth
 * disparado da aba Performance de um cliente (app/api/meta-ads/connect com
 * clientId, ver lib/meta/ads-oauth.ts::signState). Sem isso as contas
 * conectadas ficariam soltas no nível da org, sem dono.
 */
export async function connectMetaAdsAccountsForClient(orgSlug: string, clientId: string, selectedAccountIds: string[]) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'trafego')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const cookieStore = cookies()
  const token = cookieStore.get('meta_ads_pending_token')?.value
  const pendingOrg = cookieStore.get('meta_ads_pending_org')?.value
  const pendingClient = cookieStore.get('meta_ads_pending_client')?.value
  if (!token || pendingOrg !== orgSlug || pendingClient !== clientId) {
    return { ok: false as const, error: 'Sessão de conexão expirada, tente conectar novamente' }
  }

  const { data: client } = await createClient()
    .from('contatos').select('id').eq('id', clientId).eq('organization_id', org.id).maybeSingle()
  if (!client) return { ok: false as const, error: 'Cliente não encontrado' }

  const { listAdAccountsForToken } = await import('@/lib/meta/ads-oauth')
  let available
  try {
    available = await listAdAccountsForToken(token)
  } catch (e: any) {
    return { ok: false as const, error: e?.message || 'Falha ao validar contas de anúncio' }
  }
  const availableIds = new Set(available.map(a => a.id))
  const validSelected = selectedAccountIds.filter(id => availableIds.has(id))
  if (validSelected.length === 0) {
    return { ok: false as const, error: 'Nenhuma conta válida selecionada' }
  }

  const supabase = createClient()
  const expiresAt = new Date(Date.now() + 55 * 24 * 3600 * 1000).toISOString() // ~55 dias
  await supabase
    .from('organizations')
    .update({ meta_ads_access_token: token, meta_ads_token_expires_at: expiresAt })
    .eq('id', org.id)

  let accountsConnected = 0
  for (const accountId of validSelected) {
    const meta = available.find(a => a.id === accountId)
    if (!meta) continue
    const { error } = await supabase
      .from('ad_accounts')
      .upsert(
        { organization_id: org.id, provider: 'meta', name: meta.name, external_id: meta.id, status: 'active', contato_id: clientId },
        { onConflict: 'organization_id,provider,external_id' },
      )
    if (!error) accountsConnected++
  }

  cookieStore.delete('meta_ads_pending_token')
  cookieStore.delete('meta_ads_pending_org')
  cookieStore.delete('meta_ads_pending_client')
  revalidatePath(`/app/${orgSlug}/agencias-trafego/trafego/${clientId}`)
  return { ok: true as const, accountsConnected }
}

/**
 * Bulk import of daily metrics rows. Used by CSV upload — the row format is
 * intentionally minimal (campaign_name OR campaign_id + date + spend + optional
 * counters), so we can ingest exports from Meta, Google Ads, etc. with the same
 * action. Returns counts so the UI can show "X criados, Y atualizados, Z pulados".
 */
export async function bulkRecordCampaignMetrics(
  orgSlug: string,
  rows: Array<{
    campaign_id?: string | null
    campaign_name?: string | null
    date: string
    impressions?: number
    clicks?: number
    spend_cents?: number
  }>,
  source: 'csv' | 'manual' = 'csv',
) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'marketing')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  const supabase = createClient()

  // Build a lowercased name→id map so we can resolve campaigns by name (CSVs
  // commonly have only the human name).
  const { data: orgCampaigns } = await supabase
    .from('campaigns')
    .select('id, name')
    .eq('organization_id', org.id)
  const byName = new Map<string, string>()
  for (const c of orgCampaigns || []) {
    byName.set((c.name || '').toLowerCase().trim(), c.id)
  }

  const toInsert: any[] = []
  const skipped: Array<{ row: number; reason: string }> = []

  rows.forEach((r, idx) => {
    let cid = r.campaign_id || null
    if (!cid && r.campaign_name) {
      cid = byName.get(r.campaign_name.toLowerCase().trim()) || null
    }
    if (!cid) {
      skipped.push({ row: idx + 1, reason: `Campanha "${r.campaign_name}" não encontrada` })
      return
    }
    if (!r.date || isNaN(Date.parse(r.date))) {
      skipped.push({ row: idx + 1, reason: 'Data inválida' })
      return
    }
    toInsert.push({
      organization_id: org.id,
      campaign_id: cid,
      date: r.date,
      impressions: r.impressions || 0,
      clicks: r.clicks || 0,
      spend_cents: r.spend_cents || 0,
      source,
    })
  })

  let upserted = 0
  if (toInsert.length > 0) {
    const { error, count } = await supabase
      .from('campaign_metrics_daily')
      .upsert(toInsert, { onConflict: 'campaign_id,date,source', count: 'exact' })
    if (error) return { ok: false as const, error: error.message }
    upserted = count || toInsert.length
  }

  revalidatePath(`/app/${orgSlug}/marketing`)
  return { ok: true as const, upserted, skipped }
}

export async function listCampaignMetrics(orgSlug: string, campaignId: string, from?: string, to?: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'marketing')
  if (!perm.allowed) return []
  const supabase = createClient()

  let q = supabase
    .from('campaign_metrics_daily')
    .select('id, date, impressions, clicks, spend_cents, source')
    .eq('campaign_id', campaignId)
    .eq('organization_id', org.id)
    .order('date', { ascending: false })

  if (from) q = q.gte('date', from)
  if (to) q = q.lte('date', to)

  const { data } = await q
  return data || []
}

/* -------- Marketing dashboard aggregation -------- */

export type MarketingPeriod = '7d' | '30d' | '90d' | 'mtd'

function periodStart(period: MarketingPeriod): string {
  const now = new Date()
  if (period === 'mtd') {
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  }
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

/**
 * One-shot aggregation for the Marketing page: totals for the period,
 * per-campaign breakdown (with attributed leads), and the daily time series
 * for the chart. Returns null if no data — caller renders an empty state.
 */
export async function getMarketingOverview(orgSlug: string, period: MarketingPeriod = '30d') {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'marketing')
  if (!perm.allowed) {
    return { totals: { spend_cents: 0, impressions: 0, clicks: 0, leads: 0, won_deals: 0, revenue_cents: 0 }, campaigns: [], timeSeries: [], sourcesByLeads: [], byObjective: [] }
  }
  const supabase = createClient()
  const start = periodStart(period)

  // 1) Pull campaigns + their metrics in the window.
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select(
      'id, name, objective, status, utm_campaign, color, ad_account_id, external_id, ad_accounts(name, provider)',
    )
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })

  const campaignIds = (campaigns || []).map(c => c.id)
  if (campaignIds.length === 0) {
    return {
      totals: { spend_cents: 0, impressions: 0, clicks: 0, leads: 0, won_deals: 0, revenue_cents: 0 },
      campaigns: [],
      timeSeries: [],
      sourcesByLeads: [],
      byObjective: [],
    }
  }

  const { data: metrics } = await supabase
    .from('campaign_metrics_daily')
    .select('campaign_id, date, impressions, clicks, spend_cents, meta_leads, meta_messaging_started, meta_link_clicks, meta_landing_page_views, meta_purchases, meta_purchase_value_cents')
    .in('campaign_id', campaignIds)
    .eq('organization_id', org.id)
    .gte('date', start)

  // 2) Pull leads from this org since `start` to compute attribution.
  // Match by leads.source LIKE '%form:<...>%' OR by joining with form_submissions.utm_campaign.
  // For simplicity: query form_submissions in the window, group by utm_campaign.
  const startIso = new Date(start).toISOString()
  const { data: orgForms } = await supabase.from('forms').select('id').eq('organization_id', org.id)
  const orgFormIds = (orgForms || []).map(f => f.id)
  const { data: subs } = orgFormIds.length
    ? await supabase
        .from('form_submissions')
        .select('utm_campaign, contato_id')
        .in('form_id', orgFormIds)
        .gte('created_at', startIso)
        .not('utm_campaign', 'is', null)
    : { data: [] as { utm_campaign: string | null; contato_id: string | null }[] }

  // 3) Aggregate metrics per campaign.
  const metricsByCampaign = new Map<
    string,
    { spend: number; imp: number; clicks: number; metaLeads: number; messagingStarted: number; linkClicks: number; landingPageViews: number; purchases: number; purchaseValueCents: number }
  >()
  for (const m of metrics || []) {
    const cur = metricsByCampaign.get(m.campaign_id) || {
      spend: 0, imp: 0, clicks: 0, metaLeads: 0, messagingStarted: 0, linkClicks: 0, landingPageViews: 0, purchases: 0, purchaseValueCents: 0,
    }
    cur.spend += m.spend_cents || 0
    cur.imp += m.impressions || 0
    cur.clicks += m.clicks || 0
    cur.metaLeads += m.meta_leads || 0
    cur.messagingStarted += m.meta_messaging_started || 0
    cur.linkClicks += m.meta_link_clicks || 0
    cur.landingPageViews += m.meta_landing_page_views || 0
    cur.purchases += m.meta_purchases || 0
    cur.purchaseValueCents += m.meta_purchase_value_cents || 0
    metricsByCampaign.set(m.campaign_id, cur)
  }

  // 3b) Negócios ganhos no período, atribuídos a uma campanha — alimenta
  // CAC/ROAS. Dois caminhos: (a) meta_resolved_campaign_id, gravado no
  // webhook do WhatsApp quando a conversa vem de um anúncio de
  // Click-to-WhatsApp (ad_id → campaign_id já resolvido, ver
  // resolveAdCampaignExternalId em lib/meta/ads.ts) — direto, sem match de
  // texto; (b) utm_campaign do lead (formulários/tráfego), mesmo padrão
  // de form_submissions.utm_campaign abaixo.
  const { data: wonDeals } = await supabase
    .from('contatos')
    .select('utm, value_cents, meta_resolved_campaign_id')
    .eq('organization_id', org.id)
    .eq('deal_status', 'ganho')
    .gte('updated_at', startIso)

  const utmToCampaignId = new Map<string, string>()
  for (const c of campaigns || []) {
    const key = (c.utm_campaign || '').trim().toLowerCase()
    if (key) utmToCampaignId.set(key, c.id)
  }

  const wonByCampaignId = new Map<string, { count: number; revenue_cents: number }>()
  for (const d of wonDeals || []) {
    const campaignId = d.meta_resolved_campaign_id
      || utmToCampaignId.get(String((d.utm as any)?.utm_campaign || '').trim().toLowerCase())
    if (!campaignId) continue
    const cur = wonByCampaignId.get(campaignId) || { count: 0, revenue_cents: 0 }
    cur.count += 1
    cur.revenue_cents += d.value_cents || 0
    wonByCampaignId.set(campaignId, cur)
  }

  // 4) Map utm_campaign → number of leads.
  const leadsByUtm = new Map<string, number>()
  for (const s of subs || []) {
    const key = String(s.utm_campaign || '').trim().toLowerCase()
    if (!key) continue
    leadsByUtm.set(key, (leadsByUtm.get(key) || 0) + 1)
  }

  // 5) Build per-campaign rows.
  const campaignRows = (campaigns || []).map(c => {
    const m = metricsByCampaign.get(c.id) || {
      spend: 0, imp: 0, clicks: 0, metaLeads: 0, messagingStarted: 0, linkClicks: 0, landingPageViews: 0, purchases: 0, purchaseValueCents: 0,
    }
    const utm = (c.utm_campaign || '').trim().toLowerCase()
    const leads = utm ? leadsByUtm.get(utm) || 0 : 0
    const won = wonByCampaignId.get(c.id)
    const account = Array.isArray(c.ad_accounts) ? c.ad_accounts[0] : c.ad_accounts
    const objectiveGroup = classifyObjective(c.objective)

    // CAC/ROAS agora cobrem as 3 frentes: leads/tráfego/vendas via
    // utm_campaign, e WhatsApp via meta_resolved_campaign_id (ad_id do
    // referral CTWA resolvido no webhook — ver comentário acima). Só fica
    // nulo quando não há nenhum negócio ganho atribuído no período.
    const cac_cents = won && won.count > 0 ? Math.round(m.spend / won.count) : null
    const roas = won && m.spend > 0 ? won.revenue_cents / m.spend : null

    return {
      id: c.id,
      name: c.name,
      color: c.color,
      status: c.status,
      objective: c.objective,
      objective_group: objectiveGroup,
      ad_account_id: c.ad_account_id,
      external_id: c.external_id,
      provider: account?.provider || 'other',
      account_name: account?.name || '—',
      spend_cents: m.spend,
      impressions: m.imp,
      clicks: m.clicks,
      leads,
      cpl_cents: leads > 0 ? Math.round(m.spend / leads) : null,
      ctr: m.imp > 0 ? (m.clicks / m.imp) * 100 : 0,
      meta_leads: m.metaLeads,
      meta_messaging_started: m.messagingStarted,
      meta_link_clicks: m.linkClicks,
      meta_landing_page_views: m.landingPageViews,
      meta_purchases: m.purchases,
      meta_purchase_value_cents: m.purchaseValueCents,
      cost_per_conversation_cents: m.messagingStarted > 0 ? Math.round(m.spend / m.messagingStarted) : null,
      won_deals: won?.count || 0,
      revenue_cents: won?.revenue_cents || 0,
      cac_cents,
      roas,
    }
  })

  // 6) Totals.
  const totals = campaignRows.reduce(
    (acc, c) => {
      acc.spend_cents += c.spend_cents
      acc.impressions += c.impressions
      acc.clicks += c.clicks
      acc.leads += c.leads
      acc.won_deals += c.won_deals
      acc.revenue_cents += c.revenue_cents
      return acc
    },
    { spend_cents: 0, impressions: 0, clicks: 0, leads: 0, won_deals: 0, revenue_cents: 0 },
  )

  // Agregado por objetivo — alimenta o filtro em abas no painel.
  const byObjective = Array.from(
    campaignRows.reduce((acc, c) => {
      const cur = acc.get(c.objective_group) || {
        group: c.objective_group, spend_cents: 0, leads: 0, meta_messaging_started: 0, won_deals: 0, revenue_cents: 0,
      }
      cur.spend_cents += c.spend_cents
      cur.leads += c.leads
      cur.meta_messaging_started += c.meta_messaging_started
      cur.won_deals += c.won_deals
      cur.revenue_cents += c.revenue_cents
      acc.set(c.objective_group, cur)
      return acc
    }, new Map<ObjectiveGroup, { group: ObjectiveGroup; spend_cents: number; leads: number; meta_messaging_started: number; won_deals: number; revenue_cents: number }>()).values(),
  )

  // 7) Daily time series — aggregate por (dia, conta de anúncios), pra o
  // filtro de conta poder recalcular o gráfico client-side sem refetch.
  const campaignIdToAccountId = new Map<string, string>()
  for (const c of campaigns || []) campaignIdToAccountId.set(c.id, c.ad_account_id)

  const tsMap = new Map<
    string,
    { date: string; ad_account_id: string; campaign_id: string; spend_cents: number; impressions: number; clicks: number; leads: number; meta_leads: number; meta_messaging_started: number; meta_link_clicks: number; meta_landing_page_views: number; meta_purchases: number; meta_purchase_value_cents: number; won_deals: number; revenue_cents: number }
  >()
  for (const m of metrics || []) {
    const accountId = campaignIdToAccountId.get(m.campaign_id) || 'unknown'
    const key = `${m.date}|${m.campaign_id}`
    const cur =
      tsMap.get(key) ||
      { date: m.date, ad_account_id: accountId, campaign_id: m.campaign_id, spend_cents: 0, impressions: 0, clicks: 0, leads: 0, meta_leads: 0, meta_messaging_started: 0, meta_link_clicks: 0, meta_landing_page_views: 0, meta_purchases: 0, meta_purchase_value_cents: 0, won_deals: 0, revenue_cents: 0 }
    cur.spend_cents += m.spend_cents || 0
    cur.impressions += m.impressions || 0
    cur.clicks += m.clicks || 0
    cur.meta_leads += m.meta_leads || 0
    cur.meta_messaging_started += m.meta_messaging_started || 0
    cur.meta_link_clicks += m.meta_link_clicks || 0
    cur.meta_landing_page_views += m.meta_landing_page_views || 0
    cur.meta_purchases += m.meta_purchases || 0
    cur.meta_purchase_value_cents += m.meta_purchase_value_cents || 0
    tsMap.set(key, cur)
  }

  // utm_campaign → ad_account_id/campaign_id, pra bucketar leads de
  // formulário na conta e campanha certas.
  const utmToAccountId = new Map<string, string>()
  const utmToCampaignIdForTs = new Map<string, string>()
  for (const c of campaigns || []) {
    const key = (c.utm_campaign || '').trim().toLowerCase()
    if (key) {
      utmToAccountId.set(key, c.ad_account_id)
      utmToCampaignIdForTs.set(key, c.id)
    }
  }

  // Leads per day: re-fetch with created_at so we can bucket by date.
  const { data: subsForTs } = await supabase
    .from('form_submissions')
    .select('utm_campaign, created_at')
    .gte('created_at', startIso)
    .not('utm_campaign', 'is', null)

  // Only count leads attributed to a known campaign — otherwise the donut and
  // the time series would disagree (donut filters; ts would not).
  const knownUtms = new Set(
    (campaigns || [])
      .map(c => (c.utm_campaign || '').trim().toLowerCase())
      .filter(Boolean),
  )

  for (const s of subsForTs || []) {
    const utm = String(s.utm_campaign || '').trim().toLowerCase()
    if (!knownUtms.has(utm)) continue
    const day = String(s.created_at).slice(0, 10)
    const accountId = utmToAccountId.get(utm) || 'unknown'
    const campaignId = utmToCampaignIdForTs.get(utm) || 'unknown'
    const key = `${day}|${campaignId}`
    const cur =
      tsMap.get(key) ||
      { date: day, ad_account_id: accountId, campaign_id: campaignId, spend_cents: 0, impressions: 0, clicks: 0, leads: 0, meta_leads: 0, meta_messaging_started: 0, meta_link_clicks: 0, meta_landing_page_views: 0, meta_purchases: 0, meta_purchase_value_cents: 0, won_deals: 0, revenue_cents: 0 }
    cur.leads += 1
    tsMap.set(key, cur)
  }

  const timeSeries = Array.from(tsMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  )

  // 8) Sources by leads (top-level utm_campaign distribution).
  const sourcesByLeads = Array.from(leadsByUtm.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)

  return { totals, campaigns: campaignRows, timeSeries, sourcesByLeads, byObjective }
}

/* -------- Drill-down: Conjuntos de Anúncios (CJ) e Anúncios, ao vivo -------- */

export type DrillDownError = 'token_expired' | 'not_found' | 'rate_limited' | 'unknown'

export type DrillDownRow = {
  id: string
  name: string
  status: string
  spend_cents: number
  impressions: number
  clicks: number
  ctr: number
  meta_leads: number
  meta_messaging_started: number
  meta_link_clicks: number
  meta_purchases: number
  meta_purchase_value_cents: number
  cost_per_conversation_cents: number | null
  meta_cpl_cents: number | null
}

function summarizeInsights(rows: Array<{ impressions: number; clicks: number; spend_cents: number; meta_leads: number; meta_messaging_started: number; meta_link_clicks: number; meta_purchases: number; meta_purchase_value_cents: number }>) {
  const agg = rows.reduce(
    (acc, r) => {
      acc.spend += r.spend_cents
      acc.imp += r.impressions
      acc.clicks += r.clicks
      acc.metaLeads += r.meta_leads
      acc.messagingStarted += r.meta_messaging_started
      acc.linkClicks += r.meta_link_clicks
      acc.purchases += r.meta_purchases
      acc.purchaseValueCents += r.meta_purchase_value_cents
      return acc
    },
    { spend: 0, imp: 0, clicks: 0, metaLeads: 0, messagingStarted: 0, linkClicks: 0, purchases: 0, purchaseValueCents: 0 },
  )
  return {
    spend_cents: agg.spend,
    impressions: agg.imp,
    clicks: agg.clicks,
    ctr: agg.imp > 0 ? (agg.clicks / agg.imp) * 100 : 0,
    meta_leads: agg.metaLeads,
    meta_messaging_started: agg.messagingStarted,
    meta_link_clicks: agg.linkClicks,
    meta_purchases: agg.purchases,
    meta_purchase_value_cents: agg.purchaseValueCents,
    cost_per_conversation_cents: agg.messagingStarted > 0 ? Math.round(agg.spend / agg.messagingStarted) : null,
    meta_cpl_cents: agg.metaLeads > 0 ? Math.round(agg.spend / agg.metaLeads) : null,
  }
}

function classifyMetaError(e: any): DrillDownError {
  const msg = String(e?.message || '').toLowerCase()
  if (msg.includes('190') || msg.includes('expired') || msg.includes('token')) return 'token_expired'
  if (msg.includes('rate limit') || msg.includes('too many calls') || msg.includes('613')) return 'rate_limited'
  if (msg.includes('does not exist') || msg.includes('cannot be loaded') || msg.includes('100')) return 'not_found'
  return 'unknown'
}

/**
 * Busca os Conjuntos de Anúncios (CJ) de uma campanha, 100% ao vivo na Meta
 * — sem gravar nada no banco. Só é chamado quando o usuário expande a linha
 * da campanha na tabela (ação pontual, não em todo carregamento de tela).
 */
export async function getCampaignAdSets(orgSlug: string, campaignId: string, period: MarketingPeriod = '30d') {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'marketing')
  if (!perm.allowed) return { ok: false as const, error: 'unknown' as DrillDownError }
  const supabase = createClient()

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('external_id')
    .eq('id', campaignId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!campaign?.external_id) return { ok: false as const, error: 'not_found' as DrillDownError }

  const { data: orgRow } = await supabase
    .from('organizations')
    .select('meta_ads_access_token')
    .eq('id', org.id)
    .maybeSingle()
  if (!orgRow?.meta_ads_access_token) return { ok: false as const, error: 'token_expired' as DrillDownError }

  const { fetchMetaAdSets, fetchMetaInsights } = await import('@/lib/meta/ads')
  const until = new Date().toISOString().slice(0, 10)
  const since = periodStart(period)

  try {
    const adSets = await fetchMetaAdSets(campaign.external_id, orgRow.meta_ads_access_token)
    const rows: DrillDownRow[] = []
    for (const as of adSets) {
      let insights: Awaited<ReturnType<typeof fetchMetaInsights>> = []
      try {
        insights = await fetchMetaInsights(as.id, orgRow.meta_ads_access_token, since, until)
      } catch {
        // Sem métricas nesse período pra esse CJ — segue com zeros em vez de derrubar a linha toda.
      }
      rows.push({ id: as.id, name: as.name, status: (as.effective_status || as.status || '').toLowerCase(), ...summarizeInsights(insights) })
    }
    return { ok: true as const, rows }
  } catch (e: any) {
    return { ok: false as const, error: classifyMetaError(e) }
  }
}

/**
 * Busca os Anúncios de um Conjunto de Anúncios, mesmo padrão de
 * getCampaignAdSets (ao vivo, sem gravar no banco).
 */
export async function getAdSetAds(orgSlug: string, adSetExternalId: string, period: MarketingPeriod = '30d') {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'marketing')
  if (!perm.allowed) return { ok: false as const, error: 'unknown' as DrillDownError }
  const supabase = createClient()

  const { data: orgRow } = await supabase
    .from('organizations')
    .select('meta_ads_access_token')
    .eq('id', org.id)
    .maybeSingle()
  if (!orgRow?.meta_ads_access_token) return { ok: false as const, error: 'token_expired' as DrillDownError }

  const { fetchMetaAds, fetchMetaInsights } = await import('@/lib/meta/ads')
  const until = new Date().toISOString().slice(0, 10)
  const since = periodStart(period)

  try {
    const ads = await fetchMetaAds(adSetExternalId, orgRow.meta_ads_access_token)
    const rows: DrillDownRow[] = []
    for (const ad of ads) {
      let insights: Awaited<ReturnType<typeof fetchMetaInsights>> = []
      try {
        insights = await fetchMetaInsights(ad.id, orgRow.meta_ads_access_token, since, until)
      } catch {
        // Sem métricas nesse período pra esse anúncio — segue com zeros.
      }
      rows.push({ id: ad.id, name: ad.name, status: (ad.effective_status || ad.status || '').toLowerCase(), ...summarizeInsights(insights) })
    }
    return { ok: true as const, rows }
  } catch (e: any) {
    return { ok: false as const, error: classifyMetaError(e) }
  }
}
