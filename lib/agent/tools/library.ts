import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import type { AgentContext } from '@/lib/agent/context'
import type { ToolDef } from '@/lib/agent/execute'

/** Resolve um cliente por UUID ou por nome (busca ilike), sempre escopado
 *  ao org do Agent Context — mesmo helper de lib/agent/tools/clients.ts,
 *  duplicado aqui pra não criar acoplamento entre arquivos de tools. */
async function resolveClient(ctx: AgentContext, client: string): Promise<{ id: string; name: string } | null> {
  const supabase = createAdminClient()
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(client)

  if (isUuid) {
    const { data } = await supabase
      .from('contatos').select('id, name')
      .eq('id', client).eq('organization_id', ctx.orgId).eq('status', 'cliente')
      .maybeSingle()
    return data
  }

  const { data } = await supabase
    .from('contatos').select('id, name')
    .eq('organization_id', ctx.orgId).eq('status', 'cliente')
    .ilike('name', `%${client}%`)
    .limit(1).maybeSingle()
  return data
}

export const listLibraryAssetsShape = {
  client: z.string().describe('ID (UUID) ou nome do cliente'),
  kind: z.enum(['bruto', 'produzido']).optional().describe('Filtra por tipo de material'),
  status: z.enum(['pendente', 'aprovado', 'alteracao_solicitada']).optional().describe('Filtra por status de aprovação'),
}

/** Lista materiais da Biblioteca (#23) de um cliente — só metadados
 *  (título, tipo, status, versão, datas, nº de comentários, campanha
 *  vinculada). Nunca retorna URL assinada nem conteúdo do arquivo: a
 *  issue é explícita que "assets não devem ser enviados indiscriminadamente
 *  ao contexto do modelo" — quem precisa ver o material abre a Biblioteca
 *  no painel, o agente só sabe o que existe e em que estado está. */
export const listLibraryAssetsTool: ToolDef<{ client: string; kind?: string; status?: string }> = {
  name: 'list_library_assets',
  description: 'Lista os materiais (brutos e criativos produzidos) da Biblioteca de Tráfego de um cliente, com status de aprovação — só metadados, nunca o arquivo em si.',
  riskLevel: 'READ',
  requiresApproval: false,
  permissionKey: 'trafego',
  capabilityKey: 'vertical.traffic',
  handler: async (ctx, input) => {
    const resolved = await resolveClient(ctx, input.client)
    if (!resolved) throw new Error(`Cliente "${input.client}" não encontrado`)

    const supabase = createAdminClient()
    let q = supabase
      .from('library_assets')
      .select('id, root_asset_id, kind, version, title, status, campaign_id, created_at, campaigns(name)')
      .eq('organization_id', ctx.orgId)
      .eq('contato_id', resolved.id)
      .order('version', { ascending: false })

    if (input.kind) q = q.eq('kind', input.kind)
    if (input.status) q = q.eq('status', input.status)

    const { data: assets } = await q
    if (!assets || assets.length === 0) return { client: resolved.name, assets: [] }

    const assetIds = assets.map(a => a.id)
    const { data: commentCounts } = await supabase
      .from('library_asset_comments')
      .select('asset_id')
      .in('asset_id', assetIds)

    const commentCountByAsset = new Map<string, number>()
    for (const c of commentCounts || []) {
      commentCountByAsset.set(c.asset_id, (commentCountByAsset.get(c.asset_id) || 0) + 1)
    }

    // Só a versão mais recente de cada cadeia — igual à listagem do painel.
    const latestByRoot = new Map<string, typeof assets[number]>()
    for (const a of assets) {
      const current = latestByRoot.get(a.root_asset_id)
      if (!current || a.version > current.version) latestByRoot.set(a.root_asset_id, a)
    }

    const result = Array.from(latestByRoot.values())
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(a => ({
        id: a.id,
        title: a.title,
        kind: a.kind,
        status: a.status,
        version: a.version,
        createdAt: a.created_at,
        commentsCount: commentCountByAsset.get(a.id) || 0,
        campaignName: (a.campaigns as any)?.name || null,
      }))

    return { client: resolved.name, assets: result }
  },
}
