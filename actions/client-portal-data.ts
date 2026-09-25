'use server'

/**
 * Dados exibidos no Portal do Cliente (Biblioteca, Conversões,
 * Contas/Performance) — separado de actions/client-portal.ts (que ficou
 * grande demais) pra manter o núcleo de auth/acesso do portal
 * (requirePortalAccess/listPortalAccess/login) enxuto. Mesmas regras de
 * segurança documentadas lá: admin client + filtro explícito por
 * access.organizationId/contatoId, nunca confiando em RLS sozinho (essas
 * tabelas têm policy pensada pro membro interno, não pro usuário externo).
 */

import { createAdminClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/types'
import { requirePortalAccess } from '@/actions/client-portal'

export async function listPortalCreatives(contatoId: string) {
  const access = await requirePortalAccess(contatoId)
  const admin = createAdminClient()
  const { data } = await admin
    .from('campaign_creatives')
    .select('id, title, media_type, status, public_token, created_at')
    .eq('organization_id', access.organizationId)
    .eq('contato_id', contatoId)
    .order('created_at', { ascending: false })
  return data || []
}

export type PortalLibraryAsset = {
  id: string
  title: string
  kind: 'bruto' | 'produzido'
  status: string
  publicToken: string | null
  version: number
  createdAt: string
}

/** Biblioteca (issue #23) exposta no Portal — só a versão mais recente de
 *  cada cadeia, igual `listAssetChains` faz pro painel interno. */
export async function listPortalLibraryAssets(contatoId: string): Promise<PortalLibraryAsset[]> {
  const access = await requirePortalAccess(contatoId)
  const admin = createAdminClient()
  const { data } = await admin
    .from('library_assets')
    .select('id, root_asset_id, kind, status, public_token, version, title, created_at')
    .eq('organization_id', access.organizationId)
    .eq('contato_id', contatoId)
    .order('version', { ascending: false })
  if (!data) return []

  const latestByRoot = new Map<string, any>()
  for (const row of data) {
    const current = latestByRoot.get(row.root_asset_id)
    if (!current || row.version > current.version) latestByRoot.set(row.root_asset_id, row)
  }

  return Array.from(latestByRoot.values())
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map(row => ({
      id: row.id, title: row.title, kind: row.kind, status: row.status,
      publicToken: row.public_token, version: row.version, createdAt: row.created_at,
    }))
}

/** Gera (ou reaproveita) o token público de aprovação de um asset a
 *  partir do portal — mesma lógica de generateAssetLink (painel interno),
 *  mas validada contra a membership do portal em vez da permissão
 *  'trafego'. Nunca gera token pra um asset de outro cliente. */
export async function getOrCreatePortalAssetLink(contatoId: string, assetId: string) {
  const access = await requirePortalAccess(contatoId)
  const admin = createAdminClient()
  const { data: asset } = await admin
    .from('library_assets').select('id, public_token')
    .eq('id', assetId).eq('organization_id', access.organizationId).eq('contato_id', contatoId)
    .maybeSingle()
  if (!asset) return { ok: false as const, error: 'Material não encontrado.' }

  if (asset.public_token) return { ok: true as const, token: asset.public_token }

  const token = Array.from(crypto.getRandomValues(new Uint8Array(12))).map(b => b.toString(16).padStart(2, '0')).join('')
  const { error } = await admin.from('library_assets').update({ public_token: token }).eq('id', assetId)
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const, token }
}

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
