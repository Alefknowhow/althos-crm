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
