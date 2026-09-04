'use server'

/**
 * Ad account CRUD + Meta Ads OAuth login status. Split out of
 * marketing.ts.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization, isImpersonating } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

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

export async function deleteAdAccount(orgSlug: string, id: string, force = false) {
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

  // Sem `force`, avisa e para — evita apagar dado sincronizado sem querer.
  // Com `force` (usuário já confirmou o aviso), segue: campaigns tem
  // ON DELETE CASCADE em ad_account_id (e campaign_metrics_daily em
  // campaign_id), então apagar a conta já limpa tudo em cascata no banco.
  if (count && count > 0 && !force) {
    return {
      ok: false as const,
      error: `Conta possui ${count} campanha(s) sincronizada(s).`,
      campaignCount: count,
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

/** Se a org tem um login do Facebook (Meta Ads) ativo — token guardado em
 *  organizations.meta_ads_access_token, obtido via OAuth em connectMetaAdsAccounts.
 *  Busca também o nome do usuário Facebook logado (pra exibir "conectado como
 *  X" na tela, em vez de só um badge genérico). */
export async function getMetaAdsLoginStatus(orgSlug: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('organizations')
    .select('meta_ads_access_token, meta_ads_token_expires_at')
    .eq('id', org.id)
    .maybeSingle()

  if (!data?.meta_ads_access_token) {
    return { connected: false as const, expiresAt: null, userName: null }
  }

  const { getMetaUserProfile } = await import('@/lib/meta/ads-oauth')
  let userName: string | null = null
  try {
    const profile = await getMetaUserProfile(data.meta_ads_access_token)
    userName = profile.name
  } catch {
    // Token pode ter expirado/sido revogado do lado da Meta — segue mostrando
    // "conectado" (o token ainda está salvo), só sem o nome.
  }

  return { connected: true as const, expiresAt: data.meta_ads_token_expires_at ?? null, userName }
}

/** Desconecta o login do Facebook da org (limpa o token guardado). As
 *  contas de anúncio já trazidas (ad_accounts) continuam cadastradas — só
 *  param de sincronizar até um novo login. Pra reconectar do zero (ex.:
 *  regravar o fluxo de OAuth pro App Review), use isso e depois "+ Nova
 *  conta" de novo. */
export async function disconnectMetaAdsLogin(orgSlug: string) {
  if (isImpersonating()) {
    return { ok: false as const, error: 'Ações destrutivas não são permitidas em modo de impersonação.' }
  }
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'marketing')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  const supabase = createClient()

  const { error } = await supabase
    .from('organizations')
    .update({ meta_ads_access_token: null, meta_ads_token_expires_at: null })
    .eq('id', org.id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/marketing/contas`)
  return { ok: true as const }
}
