import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import type { ToolDef } from '@/lib/agent/execute'
import { listCampaignsByClientCore } from '@/actions/marketing'

async function resolveClientId(orgId: string, client: string): Promise<{ id: string; name: string } | null> {
  const supabase = createAdminClient()
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(client)
  const query = supabase.from('contatos').select('id, name').eq('organization_id', orgId).eq('status', 'cliente')
  const { data } = isUuid
    ? await query.eq('id', client).maybeSingle()
    : await query.ilike('name', `%${client}%`).limit(1).maybeSingle()
  return data
}

export const getCampaignsShape = {
  client: z.string().describe('ID (UUID) ou nome do cliente'),
}

export const getCampaignsTool: ToolDef<{ client: string }> = {
  name: 'get_campaigns',
  description: 'Lista as campanhas de anúncio vinculadas a um cliente, com gasto/impressões/cliques dos últimos 30 dias.',
  riskLevel: 'READ',
  requiresApproval: false,
  permissionKey: 'trafego',
  handler: async (ctx, input) => {
    const resolved = await resolveClientId(ctx.orgId, input.client)
    if (!resolved) throw new Error(`Cliente "${input.client}" não encontrado`)
    const supabase = createAdminClient()
    const campaigns = await listCampaignsByClientCore(supabase, ctx.orgId, resolved.id)
    return { client: resolved.name, campaigns }
  },
}

export const getCampaignPerformanceShape = {
  client: z.string().describe('ID (UUID) ou nome do cliente'),
  campaignId: z.string().describe('ID da campanha (retornado por get_campaigns)'),
}

export const getCampaignPerformanceTool: ToolDef<{ client: string; campaignId: string }> = {
  name: 'get_campaign_performance',
  description: 'Retorna a performance normalizada (gasto, impressões, cliques) de UMA campanha específica de um cliente, últimos 30 dias.',
  riskLevel: 'READ',
  requiresApproval: false,
  permissionKey: 'trafego',
  handler: async (ctx, input) => {
    const resolved = await resolveClientId(ctx.orgId, input.client)
    if (!resolved) throw new Error(`Cliente "${input.client}" não encontrado`)
    const supabase = createAdminClient()
    const campaigns = await listCampaignsByClientCore(supabase, ctx.orgId, resolved.id)
    const campaign = (campaigns as any[]).find(c => c.id === input.campaignId)
    if (!campaign) throw new Error(`Campanha "${input.campaignId}" não encontrada para este cliente`)
    return { client: resolved.name, ...campaign }
  },
}
