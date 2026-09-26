'use server'

/**
 * Dados exibidos no Portal do Cliente (Conversões, Contas/Performance) —
 * separado de actions/client-portal.ts (que ficou grande demais) pra
 * manter o núcleo de auth/acesso do portal
 * (requirePortalAccess/listPortalAccess/login) enxuto. Biblioteca do
 * Portal vive em actions/client-portal-library.ts (também extraído por
 * limite de tamanho). Mesmas regras de segurança documentadas lá: admin
 * client + filtro explícito por access.organizationId/contatoId, nunca
 * confiando em RLS sozinho (essas tabelas têm policy pensada pro membro
 * interno, não pro usuário externo).
 */

import { createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/types'
import { requirePortalAccess } from '@/actions/client-portal'
import type { DrillDownError, DrillDownRow } from '@/actions/marketing-overview'

export type PortalConversion = {
  id: string
  type: 'lead' | 'qualificado' | 'agendamento' | 'venda' | 'perdido'
  valueCents: number | null
  occurredAt: string
  note: string | null
  createdAt: string
}

const CONVERSION_TYPES = ['lead', 'qualificado', 'agendamento', 'venda', 'perdido'] as const

/** Registro manual de conversão pelo cliente (issue #27 §5) — complementa
 *  o funil automático de tracking_links quando o resultado real não é
 *  capturado automaticamente. */
export async function submitPortalConversion(
  contatoId: string,
  input: { type: string; valueCents?: number | null; occurredAt?: string | null; note?: string | null },
) {
  const access = await requirePortalAccess(contatoId)
  if (!CONVERSION_TYPES.includes(input.type as any)) return { ok: false as const, error: 'Tipo de conversão inválido.' }

  const user = await getUser()
  const admin = createAdminClient()
  const { error } = await admin.from('portal_conversions').insert({
    organization_id: access.organizationId,
    contato_id: contatoId,
    type: input.type,
    value_cents: input.valueCents ?? null,
    occurred_at: input.occurredAt || new Date().toISOString().slice(0, 10),
    note: input.note?.trim() || null,
    submitted_by: user?.id ?? null,
  })
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}

export async function listPortalConversions(contatoId: string): Promise<PortalConversion[]> {
  const access = await requirePortalAccess(contatoId)
  const admin = createAdminClient()
  const { data } = await admin
    .from('portal_conversions')
    .select('id, type, value_cents, occurred_at, note, created_at')
    .eq('organization_id', access.organizationId)
    .eq('contato_id', contatoId)
    .order('occurred_at', { ascending: false })
  return (data || []).map((r: any) => ({
    id: r.id, type: r.type, valueCents: r.value_cents, occurredAt: r.occurred_at, note: r.note, createdAt: r.created_at,
  }))
}

export type PortalAdAccount = { id: string; name: string; provider: string; status: string }
export type PortalCampaign = {
  id: string
  name: string
  objective: string | null
  status: string
  ad_accounts: { name: string; provider: string } | null
  metrics: { impressions: number; clicks: number; spend_cents: number; leads: number }
}

/** Contas/Performance por conta (issue #27 §2) — mesma leitura já usada no
 *  painel interno (marketing-accounts.ts::listAdAccountsByClient/
 *  listCampaignsByClient), mas via admin client + filtro explícito, já que
 *  o usuário do portal não tem membership pra passar pela RLS. */
export async function listPortalAdAccounts(contatoId: string): Promise<PortalAdAccount[]> {
  const access = await requirePortalAccess(contatoId)
  const admin = createAdminClient()
  const { data } = await admin
    .from('ad_accounts')
    .select('id, name, provider, status')
    .eq('organization_id', access.organizationId)
    .eq('contato_id', contatoId)
  return data || []
}

export async function listPortalCampaigns(contatoId: string, days = 30): Promise<PortalCampaign[]> {
  const access = await requirePortalAccess(contatoId)
  const admin = createAdminClient()
  // Reaproveita o core sem-auth já usado pelo painel interno e pela Agent
  // Layer (listCampaignsByClientCore) — mesma query/tabelas exatas
  // (campaign_metrics_daily), só que com admin client em vez de sessão de
  // membro interno.
  const { listCampaignsByClientCore } = await import('@/actions/marketing-accounts')
  const data = await listCampaignsByClientCore(admin, access.organizationId, contatoId, days)
  return (data as unknown) as PortalCampaign[]
}

/** Drill-down Meta Campanha → Conjunto de Anúncios (issue #27/#61 2.2) —
 *  pro Portal, sob demanda (só quando o cliente expande uma campanha).
 *  Confirma que a campanha pertence a uma ad_account **deste** contato
 *  antes de buscar qualquer coisa na Meta — nunca aceita um campaignId
 *  "solto" vindo do client. Token da org nunca sai do server. Google não
 *  tem integração viva: contas 'google' simplesmente não têm drill-down
 *  (ficam só no nível de campanha, já mostrado em listPortalCampaigns). */
export async function listPortalCampaignChildren(
  contatoId: string,
  campaignId: string,
): Promise<{ ok: true; rows: DrillDownRow[] } | { ok: false; error: DrillDownError | 'not_traffic_client' }> {
  const access = await requirePortalAccess(contatoId)
  const admin = createAdminClient()

  const { data: campaign } = await admin
    .from('campaigns')
    .select('id, external_id, ad_account_id, ad_accounts!inner(id, contato_id, organization_id, provider)')
    .eq('id', campaignId)
    .eq('organization_id', access.organizationId)
    .maybeSingle()
  const account = (campaign as any)?.ad_accounts
  if (!campaign?.external_id || !account || account.contato_id !== contatoId) {
    return { ok: false as const, error: 'not_found' as DrillDownError }
  }
  if (account.provider !== 'meta') return { ok: false as const, error: 'not_traffic_client' as const }

  const { data: orgRow } = await admin
    .from('organizations')
    .select('meta_ads_access_token')
    .eq('id', access.organizationId)
    .maybeSingle()
  if (!orgRow?.meta_ads_access_token) return { ok: false as const, error: 'token_expired' as DrillDownError }

  const { fetchMetaAdSets, fetchMetaInsights } = await import('@/lib/meta/ads')
  const { summarizeInsights, classifyMetaError } = await import('@/actions/marketing-drilldown')
  const until = new Date().toISOString().slice(0, 10)
  const since = new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10)

  try {
    const adSets = await fetchMetaAdSets(campaign.external_id, orgRow.meta_ads_access_token)
    const rows: DrillDownRow[] = []
    for (const as of adSets) {
      let insights: Awaited<ReturnType<typeof fetchMetaInsights>> = []
      try {
        insights = await fetchMetaInsights(as.id, orgRow.meta_ads_access_token, since, until)
      } catch { /* sem métricas nesse período pra esse CJ */ }
      rows.push({ id: as.id, name: as.name, status: (as.effective_status || as.status || '').toLowerCase(), ...summarizeInsights(insights) })
    }
    return { ok: true as const, rows }
  } catch (e: any) {
    return { ok: false as const, error: classifyMetaError(e) }
  }
}
