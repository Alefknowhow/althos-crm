'use server'

/**
 * Meta Ads OAuth connection flow (org-level and per-client), account
 * assignment, and bulk metric recording. Split out of marketing.ts.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { syncAdAccountCampaigns } from './marketing-campaigns'

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
  let campaignsSynced = 0
  for (const accountId of validSelected) {
    const meta = available.find(a => a.id === accountId)
    if (!meta) continue
    const { data: row, error } = await supabase
      .from('ad_accounts')
      .upsert(
        { organization_id: org.id, provider: 'meta', name: meta.name, external_id: meta.id, status: 'active' },
        { onConflict: 'organization_id,provider,external_id' },
      )
      .select('id')
      .single()
    if (error || !row) continue
    accountsConnected++

    // Sincroniza na hora — pra quem acabou de conectar já cair direto no
    // painel com dado de verdade, sem precisar de um segundo passo manual
    // ("Sincronizar" em Contas). Falha aqui não desfaz a conexão, só deixa
    // pra sincronizar depois (o botão manual continua disponível).
    try {
      const syncResult = await syncAdAccountCampaigns(orgSlug, row.id)
      if (syncResult.ok) campaignsSynced += syncResult.campaignsSynced
    } catch { /* best-effort */ }
  }

  cookieStore.delete('meta_ads_pending_token')
  cookieStore.delete('meta_ads_pending_org')
  revalidatePath(`/app/${orgSlug}/marketing/contas`)
  revalidatePath(`/app/${orgSlug}/marketing`)
  return { ok: true as const, accountsConnected, campaignsSynced }
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
 * Confirmado com o usuário: o modelo real é 1 Business Manager da agência
 * com acesso às contas de todos os clientes — não é 1 login por cliente.
 * Então, se a org já tem um `meta_ads_access_token` válido, a aba
 * Performance de qualquer cliente pode listar as contas acessíveis por
 * ESSE token direto, sem pedir login de novo — só falta escolher/atribuir
 * qual conta é desse cliente (assignMetaAdAccountToClient abaixo).
 */
export async function listAssignableMetaAdAccounts(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'trafego')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  const { data: orgRow } = await supabase
    .from('organizations').select('meta_ads_access_token').eq('id', org.id).maybeSingle()
  if (!orgRow?.meta_ads_access_token) {
    return { ok: true as const, connected: false as const, options: [], assignedElsewhere: [] as string[] }
  }

  const { listAdAccountsForToken } = await import('@/lib/meta/ads-oauth')
  let options
  try {
    options = await listAdAccountsForToken(orgRow.meta_ads_access_token)
  } catch (e: any) {
    return { ok: false as const, error: e?.message || 'Falha ao listar contas de anúncio' }
  }

  // Contas Meta já atribuídas a QUALQUER cliente na org — pra sinalizar na
  // UI e evitar atribuir a mesma conta a dois clientes por engano.
  const { data: existing } = await supabase
    .from('ad_accounts')
    .select('external_id')
    .eq('organization_id', org.id)
    .eq('provider', 'meta')
    .not('contato_id', 'is', null)
  const assignedElsewhere = (existing || []).map(r => r.external_id).filter(Boolean) as string[]

  return { ok: true as const, connected: true as const, options, assignedElsewhere }
}

/** Atribui uma conta já acessível pelo token da org (ver acima) a um cliente específico — sem precisar refazer o OAuth. */
export async function assignMetaAdAccountToClient(orgSlug: string, clientId: string, accountId: string, accountName: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'trafego')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  const { data: client } = await supabase
    .from('contatos').select('id').eq('id', clientId).eq('organization_id', org.id).maybeSingle()
  if (!client) return { ok: false as const, error: 'Cliente não encontrado' }

  const { error } = await supabase
    .from('ad_accounts')
    .upsert(
      { organization_id: org.id, provider: 'meta', name: accountName, external_id: accountId, status: 'active', contato_id: clientId },
      { onConflict: 'organization_id,provider,external_id' },
    )
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/agencias-trafego/trafego/${clientId}`)
  return { ok: true as const }
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
