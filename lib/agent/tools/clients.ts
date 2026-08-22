import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import type { AgentContext } from '@/lib/agent/context'
import type { ToolDef } from '@/lib/agent/execute'
import { getClientPerformanceSummaryCore } from '@/actions/trafego-performance'

/** Resolve um cliente por UUID ou por nome (busca ilike), sempre escopado
 *  ao org do Agent Context — nunca confia num id vindo do agente sem
 *  confirmar que pertence à mesma org. */
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

export const getClientsShape = {
  search: z.string().optional().describe('Busca por nome'),
  limit: z.number().int().min(1).max(100).optional().describe('Máximo de resultados (padrão 50)'),
  offset: z.number().int().min(0).optional(),
}

export const getClientsTool: ToolDef<{ search?: string; limit?: number; offset?: number }> = {
  name: 'get_clients',
  description: 'Lista os clientes de tráfego pago gerenciados pela agência (contatos marcados como cliente). Use search para filtrar por nome.',
  riskLevel: 'READ',
  requiresApproval: false,
  permissionKey: 'trafego',
  handler: async (ctx, input) => {
    const supabase = createAdminClient()
    let q = supabase
      .from('contatos')
      .select('id, name, traffic_client_profile, created_at')
      .eq('organization_id', ctx.orgId)
      .eq('status', 'cliente')
      .order('name', { ascending: true })
      .range(input.offset || 0, (input.offset || 0) + (input.limit || 50) - 1)

    if (input.search) q = q.ilike('name', `%${input.search}%`)

    const { data } = await q
    return (data || []).map(c => ({
      id: c.id,
      name: c.name,
      niche: (c.traffic_client_profile as any)?.niche || null,
      objective: (c.traffic_client_profile as any)?.objective || null,
      monthlyBudgetCents: (c.traffic_client_profile as any)?.monthlyBudgetCents || null,
    }))
  },
}

export const getClientShape = {
  client: z.string().describe('ID (UUID) ou nome do cliente'),
}

export const getClientTool: ToolDef<{ client: string }> = {
  name: 'get_client',
  description: 'Retorna o perfil completo de um cliente de tráfego (nicho, objetivo, orçamento, público-alvo, regras da campanha). Aceita nome ou UUID.',
  riskLevel: 'READ',
  requiresApproval: false,
  permissionKey: 'trafego',
  handler: async (ctx, input) => {
    const resolved = await resolveClient(ctx, input.client)
    if (!resolved) throw new Error(`Cliente "${input.client}" não encontrado`)
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('contatos').select('id, name, email, phone, traffic_client_profile, created_at')
      .eq('id', resolved.id).eq('organization_id', ctx.orgId).maybeSingle()
    return data
  },
}

export const getClientPerformanceShape = {
  client: z.string().describe('ID (UUID) ou nome do cliente'),
  startDate: z.string().optional().describe('YYYY-MM-DD (padrão: 7 dias atrás)'),
  endDate: z.string().optional().describe('YYYY-MM-DD (padrão: hoje)'),
}

export const getClientPerformanceTool: ToolDef<{ client: string; startDate?: string; endDate?: string }> = {
  name: 'get_client_performance',
  description: 'Retorna métricas de performance de um cliente no período: investimento, impressões, cliques, CTR, CPC, CPM, vendas, receita e ROAS. Normalizado independente da plataforma de anúncio.',
  riskLevel: 'READ',
  requiresApproval: false,
  permissionKey: 'trafego',
  handler: async (ctx, input) => {
    const resolved = await resolveClient(ctx, input.client)
    if (!resolved) throw new Error(`Cliente "${input.client}" não encontrado`)

    const to = input.endDate ? new Date(input.endDate) : new Date()
    const from = input.startDate ? new Date(input.startDate) : new Date(to.getTime() - 7 * 86_400_000)

    const supabase = createAdminClient()
    const summary = await getClientPerformanceSummaryCore(supabase, ctx.orgId, resolved.id, { from, to })
    return { client: resolved.name, period: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }, ...summary }
  },
}

export const getClientTargetsTool: ToolDef<{ client: string }> = {
  name: 'get_client_targets',
  description: 'Retorna as metas configuradas para um cliente (ROAS alvo, CPL alvo, leads/mês alvo, receita/mês alvo) — permite comparar resultado real vs. meta.',
  riskLevel: 'READ',
  requiresApproval: false,
  permissionKey: 'trafego',
  handler: async (ctx, input) => {
    const resolved = await resolveClient(ctx, input.client)
    if (!resolved) throw new Error(`Cliente "${input.client}" não encontrado`)
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('contatos').select('traffic_client_profile')
      .eq('id', resolved.id).eq('organization_id', ctx.orgId).maybeSingle()
    const profile = (data?.traffic_client_profile as any) || {}
    return {
      client: resolved.name,
      targetRoas: profile.targetRoas ?? null,
      targetCpl: profile.targetCpl ?? null,
      targetLeads: profile.targetLeads ?? null,
      targetRevenueCents: profile.targetRevenueCents ?? null,
    }
  },
}
