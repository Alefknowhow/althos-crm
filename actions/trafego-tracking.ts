'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { getClientPerformanceSummaryCore } from '@/actions/trafego-performance'

/**
 * Funil de tracking próprio de um cliente — investimento → cliques → leads →
 * vendas → receita, a partir dos tracking_links/tracking_clicks reais desse
 * cliente. Ver plano em C:\Users\aleft\.claude\plans\dazzling-baking-anchor.md.
 */

export type ClientTrackingFunnel = {
  investmentCents: number
  clicks: number
  leads: number
  sales: number
  revenueCents: number
  cplCents: number | null
  cpaCents: number | null
  cacCents: number | null // = cpa aqui (custo por venda), mantido separado pra semântica futura
  roas: number | null
  clickToLeadPct: number | null
  leadToSalePct: number | null
}

export type ClientJourneyStep = {
  clickId: string
  linkLabel: string | null
  linkCode: string
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  createdAt: string
}

export type ConvertedLead = {
  contatoId: string
  name: string
  createdAt: string
  journey: ClientJourneyStep[]
}

async function requireAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'trafego')
  if (!check.allowed) throw new Error(check.reason || 'Sem permissão')
  return org
}

export async function getClientTrackingFunnel(
  orgSlug: string,
  contatoId: string,
  range: { from: Date; to: Date },
): Promise<ClientTrackingFunnel> {
  const org = await requireAccess(orgSlug)
  const supabase = createClient()
  const fromIso = range.from.toISOString()
  const toIso = range.to.toISOString()

  const { data: links } = await supabase
    .from('tracking_links')
    .select('id')
    .eq('organization_id', org.id)
    .eq('contato_id', contatoId)
  const linkIds = (links || []).map(l => l.id)

  let clicks = 0
  let leads = 0
  if (linkIds.length > 0) {
    const [{ count: clickCount }, { count: leadCount }] = await Promise.all([
      supabase.from('tracking_clicks').select('id', { count: 'exact', head: true })
        .in('link_id', linkIds).gte('created_at', fromIso).lte('created_at', toIso),
      supabase.from('tracking_clicks').select('id', { count: 'exact', head: true })
        .in('link_id', linkIds).gte('created_at', fromIso).lte('created_at', toIso)
        .not('converted_contato_id', 'is', null),
    ])
    clicks = clickCount || 0
    leads = leadCount || 0
  }

  // Investimento/receita reaproveitam o mesmo cálculo já usado na Visão
  // Geral (getClientPerformanceSummaryCore) — não duplica fórmula.
  const perf = await getClientPerformanceSummaryCore(supabase, org.id, contatoId, range)

  return {
    investmentCents: perf.investmentCents,
    clicks,
    leads,
    sales: perf.salesCount,
    revenueCents: perf.revenueCents,
    cplCents: leads > 0 ? perf.investmentCents / leads : null,
    cpaCents: perf.salesCount > 0 ? perf.investmentCents / perf.salesCount : null,
    cacCents: perf.salesCount > 0 ? perf.investmentCents / perf.salesCount : null,
    roas: perf.investmentCents > 0 ? perf.revenueCents / perf.investmentCents : null,
    clickToLeadPct: clicks > 0 ? (leads / clicks) * 100 : null,
    leadToSalePct: leads > 0 ? (perf.salesCount / leads) * 100 : null,
  }
}

export type LinkPerformance = {
  linkId: string
  code: string
  label: string | null
  clicks: number
  leads: number
  sales: number
  revenueCents: number
  clickToLeadPct: number | null
}

/**
 * Performance por link individual — modelo de atribuição **last-touch**:
 * o lead é creditado ao último clique antes da conversão (mesmo clique que
 * grava `contatos.tracking_link_id` em submitPublicForm). Cada clique da
 * jornada continua registrado em tracking_clicks pra quem quiser analisar
 * multi-touch depois (ver listClientConvertedJourneys) — este cálculo é só
 * "qual link levou o crédito da conversão", não "todos os links que
 * participaram". Sem CPL/ROAS por link aqui de propósito: o investimento é
 * medido por campanha (campaign_metrics_daily), não por link individual —
 * ratear o gasto por link daria um número inventado, não medido.
 */
export async function listLinkPerformance(
  orgSlug: string,
  contatoId: string,
  range: { from: Date; to: Date },
): Promise<LinkPerformance[]> {
  const org = await requireAccess(orgSlug)
  const supabase = createClient()
  const fromIso = range.from.toISOString()
  const toIso = range.to.toISOString()

  const { data: links } = await supabase
    .from('tracking_links')
    .select('id, code, label')
    .eq('organization_id', org.id)
    .eq('contato_id', contatoId)
  if (!links || links.length === 0) return []
  const linkIds = links.map(l => l.id)

  // Cliques por link (todos, não só os que converteram).
  const { data: clickRows } = await supabase
    .from('tracking_clicks')
    .select('link_id')
    .in('link_id', linkIds)
    .gte('created_at', fromIso)
    .lte('created_at', toIso)
  const clicksByLink = new Map<string, number>()
  for (const c of clickRows || []) clicksByLink.set(c.link_id, (clicksByLink.get(c.link_id) || 0) + 1)

  // Leads last-touch: contatos.tracking_link_id aponta pro link que recebeu
  // o crédito — é o mesmo campo já usado pela atribuição no Marketing geral
  // (ver actions/marketing.ts::getMarketingOverview).
  const { data: leadRows } = await supabase
    .from('contatos')
    .select('id, tracking_link_id')
    .in('tracking_link_id', linkIds)
    .gte('created_at', fromIso)
    .lte('created_at', toIso)
  const leadsByLink = new Map<string, string[]>()
  for (const l of leadRows || []) {
    if (!l.tracking_link_id) continue
    const arr = leadsByLink.get(l.tracking_link_id) || []
    arr.push(l.id)
    leadsByLink.set(l.tracking_link_id, arr)
  }

  const allLeadIds = (leadRows || []).map(l => l.id)
  const salesByLead = new Map<string, { count: number; revenue: number }>()
  if (allLeadIds.length > 0) {
    const { data: salesRows } = await supabase
      .from('sales')
      .select('contato_id, amount_cents')
      .in('contato_id', allLeadIds)
      .eq('organization_id', org.id)
      .eq('status', 'completed')
    for (const s of salesRows || []) {
      const cur = salesByLead.get(s.contato_id) || { count: 0, revenue: 0 }
      cur.count += 1
      cur.revenue += s.amount_cents || 0
      salesByLead.set(s.contato_id, cur)
    }
  }

  return links.map(link => {
    const clicks = clicksByLink.get(link.id) || 0
    const leadIds = leadsByLink.get(link.id) || []
    let sales = 0
    let revenueCents = 0
    for (const leadId of leadIds) {
      const s = salesByLead.get(leadId)
      if (s) { sales += s.count; revenueCents += s.revenue }
    }
    return {
      linkId: link.id,
      code: link.code,
      label: link.label,
      clicks,
      leads: leadIds.length,
      sales,
      revenueCents,
      clickToLeadPct: clicks > 0 ? (leadIds.length / clicks) * 100 : null,
    }
  })
}

/** Leads convertidos por um link deste cliente, com a jornada completa de cliques (multi-touch). */
export async function listClientConvertedJourneys(
  orgSlug: string,
  contatoId: string,
  range: { from: Date; to: Date },
  limit = 20,
): Promise<ConvertedLead[]> {
  const org = await requireAccess(orgSlug)
  const supabase = createClient()

  const { data: links } = await supabase
    .from('tracking_links')
    .select('id, code, label')
    .eq('organization_id', org.id)
    .eq('contato_id', contatoId)
  const linkById = new Map((links || []).map(l => [l.id, l]))
  const linkIds = Array.from(linkById.keys())
  if (linkIds.length === 0) return []

  const { data: convertedClicks } = await supabase
    .from('tracking_clicks')
    .select('converted_contato_id, converted_at')
    .in('link_id', linkIds)
    .not('converted_contato_id', 'is', null)
    .gte('created_at', range.from.toISOString())
    .lte('created_at', range.to.toISOString())
    .order('converted_at', { ascending: false })
    .limit(limit * 3) // várias linhas podem apontar pro mesmo contato (multi-touch)

  const contatoIds = Array.from(new Set((convertedClicks || []).map(c => c.converted_contato_id).filter(Boolean))).slice(0, limit) as string[]
  if (contatoIds.length === 0) return []

  const [{ data: contatosData }, { data: allClicks }] = await Promise.all([
    supabase.from('contatos').select('id, name, created_at').in('id', contatoIds),
    supabase.from('tracking_clicks')
      .select('id, link_id, utm_source, utm_medium, utm_campaign, created_at, converted_contato_id')
      .in('link_id', linkIds)
      .in('converted_contato_id', contatoIds)
      .order('created_at', { ascending: true }),
  ])

  const contatoById = new Map((contatosData || []).map(c => [c.id, c]))
  const journeysByContato = new Map<string, ClientJourneyStep[]>()
  for (const click of allClicks || []) {
    const cid = click.converted_contato_id as string
    const link = linkById.get(click.link_id)
    const arr = journeysByContato.get(cid) || []
    arr.push({
      clickId: click.id,
      linkLabel: link?.label || null,
      linkCode: link?.code || '',
      utmSource: click.utm_source,
      utmMedium: click.utm_medium,
      utmCampaign: click.utm_campaign,
      createdAt: click.created_at,
    })
    journeysByContato.set(cid, arr)
  }

  return contatoIds
    .map(id => contatoById.get(id))
    .filter((c): c is { id: string; name: string; created_at: string } => !!c)
    .map(c => ({
      contatoId: c.id,
      name: c.name,
      createdAt: c.created_at,
      journey: journeysByContato.get(c.id) || [],
    }))
}

export type ClientTrackingHealth = {
  metaPixelConfigured: boolean
  lastCapiSendAt: string | null
  capiFailures7d: number
  googleAdsConfigured: boolean
  activeTrackingLinks: number
  lastClickAt: string | null
  lastAccountSyncAt: string | null
  lastAccountSyncDaysAgo: number | null
  alerts: { severity: 'atencao' | 'critico'; title: string; reason: string }[]
  recentFailures: { createdAt: string; eventName: string; error: string | null }[]
}

/** Mesmo bloco "Saúde do tracking" do Portal (#27/#61 2.4), com detalhe
 *  extra que o portal não mostra: falhas recentes de CAPI com a mensagem
 *  de erro completa (útil pra agência diagnosticar, não pro cliente). */
export async function getClientTrackingHealth(orgSlug: string, contatoId: string): Promise<ClientTrackingHealth> {
  const org = await requireAccess(orgSlug)
  const supabase = createClient()

  const [{ data: pipelines }, { data: capiLast }, { count: capiFailures }, { data: links }, { data: accounts }, { data: failures }] = await Promise.all([
    supabase.from('pipelines').select('meta_pixel_id, google_ads_id').eq('organization_id', org.id),
    supabase.from('capi_event_log').select('created_at, status').eq('organization_id', org.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('capi_event_log').select('id', { count: 'exact', head: true })
      .eq('organization_id', org.id).eq('status', 'failed')
      .gte('created_at', new Date(Date.now() - 7 * 86_400_000).toISOString()),
    supabase.from('tracking_links').select('id').eq('organization_id', org.id).eq('contato_id', contatoId),
    supabase.from('ad_accounts').select('updated_at, created_at').eq('organization_id', org.id).eq('contato_id', contatoId),
    supabase.from('capi_event_log').select('created_at, event_name, error').eq('organization_id', org.id).eq('status', 'failed')
      .order('created_at', { ascending: false }).limit(10),
  ])

  const linkIds = (links || []).map(l => l.id)
  const { data: lastClick } = linkIds.length > 0
    ? await supabase.from('tracking_clicks').select('created_at').in('link_id', linkIds).order('created_at', { ascending: false }).limit(1).maybeSingle()
    : { data: null }

  const metaPixelConfigured = (pipelines || []).some(p => !!p.meta_pixel_id)
  const googleAdsConfigured = (pipelines || []).some(p => !!p.google_ads_id)

  const lastSyncedAt = (accounts || [])
    .map(a => a.updated_at || a.created_at)
    .filter(Boolean)
    .sort()
    .pop() as string | undefined
  const lastAccountSyncDaysAgo = lastSyncedAt ? Math.floor((Date.now() - new Date(lastSyncedAt).getTime()) / 86_400_000) : null

  const { computeClientAlerts } = await import('@/lib/trafego/alerts')
  const now = new Date()
  const range = { from: new Date(now.getTime() - 29 * 86_400_000), to: now }
  const prevRange = { from: new Date(range.from.getTime() - 30 * 86_400_000), to: new Date(range.from.getTime() - 1) }
  const [current, previous] = await Promise.all([
    getClientPerformanceSummaryCore(supabase, org.id, contatoId, range),
    getClientPerformanceSummaryCore(supabase, org.id, contatoId, prevRange),
  ])
  const allAlerts = computeClientAlerts(current, previous, null, lastAccountSyncDaysAgo)
  const alerts = allAlerts.filter(a => a.title === 'Conta sem sincronizar')

  return {
    metaPixelConfigured,
    lastCapiSendAt: capiLast?.created_at ?? null,
    capiFailures7d: capiFailures || 0,
    googleAdsConfigured,
    activeTrackingLinks: linkIds.length,
    lastClickAt: (lastClick as any)?.created_at ?? null,
    lastAccountSyncAt: lastSyncedAt ?? null,
    lastAccountSyncDaysAgo,
    alerts,
    recentFailures: (failures || []).map(f => ({ createdAt: f.created_at, eventName: f.event_name, error: f.error })),
  }
}
