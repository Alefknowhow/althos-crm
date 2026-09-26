'use server'

/**
 * Portal externo do cliente — Fase 3.3 do módulo Clientes (Tráfego).
 * Autenticação via Supabase Auth (nenhuma senha própria, nenhuma infra
 * nova de credenciais). O que diferencia um usuário do portal de um
 * membro interno é só NÃO ter linha em `memberships` — por isso
 * getCurrentOrganization/checkMemberPermission continuam funcionando
 * exatamente como hoje pro app interno, sem risco de um usuário do portal
 * acabar autorizado lá por engano.
 *
 * Duas metades neste arquivo:
 *  1. Lado da agência (convite/lista/remoção) — mesma permissão 'trafego'
 *     de todo o módulo.
 *  2. Lado do portal (requirePortalAccess + leitura escopada) — nunca
 *     confia em RLS sozinho pras tabelas de dados (elas têm policy pensada
 *     pro membro interno da org, não pro usuário externo), sempre filtra
 *     explicitamente por contato_id vindo da membership validada.
 */

import { z } from 'zod'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization, getUser } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import type { ClientPerformanceSummary } from '@/actions/trafego-performance'

export type ClientPortalRole = 'client_admin' | 'client_member'
export type ClientPortalMember = { id: string; user_id: string; email: string | null; role: ClientPortalRole; created_at: string }

// ---------------------------------------------------------------------
// Lado da agência
// ---------------------------------------------------------------------

async function requireAgencyAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'trafego')
  if (!check.allowed) throw new Error(check.reason || 'Sem permissão')
  return { org, user }
}

const inviteSchema = z.object({
  email: z.string().email(),
  name: z.string().max(200).optional(),
  role: z.enum(['client_admin', 'client_member']).default('client_member'),
})

/** Convida um usuário pro portal deste cliente — cria (ou reaproveita) o
 *  usuário no Supabase Auth via convite oficial (link de definição de
 *  senha enviado pelo próprio Supabase, nunca senha em texto plano
 *  passando por aqui) e vincula via client_portal_memberships. */
export async function inviteClientPortalUser(orgSlug: string, contatoId: string, raw: unknown) {
  const { org, user } = await requireAgencyAccess(orgSlug)
  const parsed = inviteSchema.safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: 'Dados inválidos: ' + parsed.error.issues[0]?.message }

  const admin = createAdminClient()
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: { name: parsed.data.name, client_portal: true },
  })

  let userId = invited?.user?.id
  if (inviteError) {
    // Usuário já existe no Supabase Auth (ex.: já é membro em outra org, ou
    // já foi convidado antes) — busca o id existente em vez de falhar.
    const { data: existing } = await admin.auth.admin.listUsers()
    const found = existing?.users?.find(u => u.email?.toLowerCase() === parsed.data.email.toLowerCase())
    if (!found) return { ok: false as const, error: inviteError.message }
    userId = found.id
  }
  if (!userId) return { ok: false as const, error: 'Falha ao criar usuário do portal.' }

  const supabase = createClient()
  const { error } = await supabase.from('client_portal_memberships').upsert(
    { organization_id: org.id, contato_id: contatoId, user_id: userId, role: parsed.data.role, invited_by: user.id },
    { onConflict: 'contato_id,user_id' },
  )
  if (error) return { ok: false as const, error: error.message }

  return { ok: true as const }
}

export async function listClientPortalMembers(orgSlug: string, contatoId: string): Promise<ClientPortalMember[]> {
  const { org } = await requireAgencyAccess(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('client_portal_memberships')
    .select('id, user_id, role, created_at')
    .eq('organization_id', org.id)
    .eq('contato_id', contatoId)
    .order('created_at', { ascending: false })
  if (!data || data.length === 0) return []

  const admin = createAdminClient()
  const emails = new Map<string, string | null>()
  await Promise.all(data.map(async m => {
    const { data: u } = await admin.auth.admin.getUserById(m.user_id)
    emails.set(m.user_id, u.user?.email ?? null)
  }))

  return data.map(m => ({ id: m.id, user_id: m.user_id, role: m.role as ClientPortalRole, created_at: m.created_at, email: emails.get(m.user_id) ?? null }))
}

export async function removeClientPortalMembership(orgSlug: string, membershipId: string) {
  const { org } = await requireAgencyAccess(orgSlug)
  const supabase = createClient()
  const { error } = await supabase.from('client_portal_memberships').delete().eq('id', membershipId).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}

// ---------------------------------------------------------------------
// Login do portal
// ---------------------------------------------------------------------

const portalLoginSchema = z.object({ email: z.string().email(), password: z.string().min(1) })

/** Autenticação do portal — mesma primitiva do login interno
 *  (signInWithPassword, Supabase Auth), mas o redirect é sempre pro
 *  próprio portal, nunca pro app interno, e falha explicitamente se o
 *  usuário não tiver nenhuma client_portal_membership (mesmo com senha
 *  correta) — credencial válida não é o mesmo que autorização aqui. */
export async function portalLogin(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const parsed = portalLoginSchema.safeParse({ email, password })
  if (!parsed.success) return { ok: false as const, error: 'Preencha e-mail e senha.' }

  const supabase = createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password })
  if (error || !data.user) return { ok: false as const, error: 'Credenciais inválidas.' }

  const access = await listPortalAccess()
  if (access.length === 0) {
    await supabase.auth.signOut()
    return { ok: false as const, error: 'Este usuário não tem acesso a nenhum portal de cliente.' }
  }

  return { ok: true as const, redirectTo: `/portal/${access[0].contatoId}` }
}

export async function portalLogout() {
  const supabase = createClient()
  await supabase.auth.signOut()
}

// ---------------------------------------------------------------------
// Lado do portal
// ---------------------------------------------------------------------

export type PortalClientAccess = { contatoId: string; contatoName: string; organizationId: string; organizationName: string; role: ClientPortalRole }

/** Lista os clientes que o usuário logado pode acessar no portal — um
 *  usuário pode, em tese, ter acesso a mais de um cliente (ex.: uma
 *  agência de marketing terceirizada que atende várias contas do
 *  cliente final). Retorna vazio (nunca lança) se não houver sessão ou
 *  nenhuma membership — o caller decide redirecionar pro login. */
export async function listPortalAccess(): Promise<PortalClientAccess[]> {
  const user = await getUser()
  if (!user) return []

  const supabase = createClient()
  const { data } = await supabase
    .from('client_portal_memberships')
    .select('contato_id, role, contatos(name), organizations(id, name)')
    .eq('user_id', user.id)

  return ((data || []) as any[])
    .filter(row => row.contatos && row.organizations)
    .map(row => ({
      contatoId: row.contato_id,
      contatoName: row.contatos.name,
      organizationId: row.organizations.id,
      organizationName: row.organizations.name,
      role: row.role as ClientPortalRole,
    }))
}

/** Valida que o usuário logado tem acesso ao cliente pedido — toda
 *  action/página do portal chama isso ANTES de ler qualquer dado. Nunca
 *  aceita contatoId sem cruzar contra a membership real do usuário. */
export async function requirePortalAccess(contatoId: string): Promise<PortalClientAccess> {
  const access = await listPortalAccess()
  const found = access.find(a => a.contatoId === contatoId)
  if (!found) throw new Error('Sem acesso a este cliente.')
  return found
}

export type PortalOverviewPlatform = 'meta' | 'google' | 'all'

/** Visão Geral do portal com período/plataforma selecionáveis (2.1) —
 *  `days` é a janela solicitada, sempre comparada com o período
 *  imediatamente anterior de mesma duração pra calcular variação %. */
export async function getPortalOverview(
  contatoId: string,
  opts?: { days?: 7 | 30 | 90; platform?: PortalOverviewPlatform },
): Promise<{ current: ClientPerformanceSummary; previous: ClientPerformanceSummary }> {
  const access = await requirePortalAccess(contatoId)
  const days = opts?.days ?? 30
  const platform = opts?.platform ?? 'all'
  const now = new Date()
  const range = { from: new Date(now.getTime() - (days - 1) * 86_400_000), to: now }
  const supabase = createClient()
  return getClientPerformanceComparisonAdmin(supabase, access.organizationId, contatoId, range, platform)
}

/** Série diária pra alimentar o gráfico da Visão Geral do portal — mesma
 *  fonte/lógica de `getClientDailySeries` (painel interno), reaproveitada
 *  via `...Core` porque o usuário do portal não tem orgSlug/sessão de membro. */
export async function getPortalDailySeries(
  contatoId: string,
  opts?: { days?: 7 | 30 | 90; platform?: PortalOverviewPlatform },
) {
  const access = await requirePortalAccess(contatoId)
  const days = opts?.days ?? 30
  const platform = opts?.platform ?? 'all'
  const now = new Date()
  const range = { from: new Date(now.getTime() - (days - 1) * 86_400_000), to: now }
  const supabase = createClient()
  const { getClientDailySeriesCore } = await import('@/actions/trafego-performance')
  return getClientDailySeriesCore(supabase, access.organizationId, contatoId, range, platform)
}

/** Quantos providers distintos o cliente tem em `ad_accounts` — usado pra
 *  só mostrar o filtro de plataforma no portal quando fizer sentido
 *  (cliente com só Meta não precisa escolher). */
export async function getPortalAdPlatforms(contatoId: string): Promise<string[]> {
  const access = await requirePortalAccess(contatoId)
  const supabase = createClient()
  const { data } = await supabase
    .from('ad_accounts')
    .select('provider')
    .eq('organization_id', access.organizationId)
    .eq('contato_id', contatoId)
  return Array.from(new Set((data || []).map(a => a.provider)))
}

// getClientPerformanceComparison exige orgSlug (resolve via sessão do
// membro interno) — o usuário do portal não tem isso, então repassamos o
// cálculo já validado (access.organizationId veio de requirePortalAccess,
// não do client) direto pra versão "Core" usada também pelo Agent Layer.
async function getClientPerformanceComparisonAdmin(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  contatoId: string,
  range: { from: Date; to: Date },
  platform?: PortalOverviewPlatform,
) {
  const { getClientPerformanceSummaryCore } = await import('@/actions/trafego-performance')
  const now = range.to
  const days = Math.round((range.to.getTime() - range.from.getTime()) / 86_400_000) + 1
  const prevRange = { from: new Date(range.from.getTime() - days * 86_400_000), to: new Date(range.from.getTime() - 1) }
  const [current, previous] = await Promise.all([
    getClientPerformanceSummaryCore(supabase, orgId, contatoId, range, platform),
    getClientPerformanceSummaryCore(supabase, orgId, contatoId, prevRange, platform),
  ])
  void now
  return { current, previous }
}

export async function listPortalReports(contatoId: string) {
  const access = await requirePortalAccess(contatoId)
  const supabase = createClient()
  const { data } = await supabase
    .from('storage_objects')
    .select('id, filename, size_bytes, created_at, metadata')
    .eq('organization_id', access.organizationId)
    .eq('status', 'active')
    .eq('metadata->>kind', 'client_report')
    .eq('metadata->>contato_id', contatoId)
    .order('created_at', { ascending: false })
  return (data || []).map((r: any) => ({
    id: r.id, filename: r.filename, size_bytes: r.size_bytes, created_at: r.created_at,
    period_start: r.metadata?.period_start ?? null, period_end: r.metadata?.period_end ?? null,
  }))
}

/** Assina a URL de um relatório pro portal — confirma que o objeto
 *  pertence ao cliente da membership antes de gerar qualquer link (nunca
 *  aceita um objectId "solto" vindo do client sem essa checagem). */
export async function getPortalReportUrl(contatoId: string, objectId: string) {
  const access = await requirePortalAccess(contatoId)
  const supabase = createClient()
  const { data: row } = await supabase
    .from('storage_objects')
    .select('id, metadata')
    .eq('id', objectId)
    .eq('organization_id', access.organizationId)
    .eq('status', 'active')
    .maybeSingle()
  if (!row || (row as any).metadata?.contato_id !== contatoId) return { ok: false as const, error: 'Relatório não encontrado.' }

  // getObjectSignedUrl exige sessão de membro interno (checkMemberPermission
  // implícito via getCurrentOrganization) — como o usuário do portal não
  // passa por ali, resolvemos a URL direto pela Storage Service aqui,
  // já tendo confirmado acima que o objeto pertence a este cliente.
  const { StorageService } = await import('@/lib/storage')
  const { data: full } = await supabase.from('storage_objects').select('*').eq('id', objectId).maybeSingle()
  if (!full) return { ok: false as const, error: 'Relatório não encontrado.' }
  try {
    const url = await StorageService.getSignedUrl(
      { provider: full.storage_provider, bucket: full.bucket, storageKey: full.storage_key },
      { downloadFilename: full.filename ?? undefined },
    )
    return { ok: true as const, url }
  } catch (e: any) {
    return { ok: false as const, error: e?.message || 'Falha ao gerar link.' }
  }
}

// Biblioteca, Conversões e Contas/Performance do Portal vivem em
// actions/client-portal-data.ts (arquivo separado pra este não crescer
// demais) — reexportadas aqui não é necessário, os callers importam de lá
// diretamente.

