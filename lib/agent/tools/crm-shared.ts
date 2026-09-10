import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { agentCanAccess, type AgentContext } from '@/lib/agent/context'
import { assertOrgWritable } from '@/lib/billing/plans'
import type { ActionContext } from '@/lib/services/context'
import type { ToolDef } from '@/lib/agent/execute'
import type { PermissionKey } from '@/lib/permissions'

export const id = z.string().uuid()
export const date = z.iso.date()
export const money = z.number().int().min(0).max(2147483647)
export const text = z.string().trim().max(10000)
export const pagination = { limit: z.number().int().min(1).max(100).default(50), offset: z.number().int().min(0).default(0) }

export async function actionContext(ctx: AgentContext): Promise<ActionContext> {
  const supabase = createAdminClient()
  const { data: org, error } = await supabase.from('organizations').select('*').eq('id', ctx.orgId).single()
  if (error || !org) throw new Error('Organização não encontrada.')
  assertOrgWritable(org)
  return { supabase, org, user: { id: ctx.userId }, impersonating: false,
    checkPermission: async keys => ({ allowed: keys.some(key => agentCanAccess(ctx, key)), reason: 'Sem permissão para este módulo.' }),
  }
}

export function requireModule(ctx: AgentContext, key: PermissionKey) {
  if (!agentCanAccess(ctx, key)) throw new Error(`Sem permissão para ${key}.`)
}

export async function record(ctx: AgentContext, table: string, recordId: string, columns = '*') {
  const db = createAdminClient()
  let query = db.from(table).select(table === 'pipeline_stages' ? '*, pipelines!inner(organization_id)' : columns).eq('id', recordId)
  query = query.eq(table === 'pipeline_stages' ? 'pipelines.organization_id' : 'organization_id', ctx.orgId)
  const { data, error } = await query.single()
  if (error || !data) throw new Error('Registro não encontrado nesta organização.')
  return data as unknown as Record<string, any>
}

export function unwrap(result: any) {
  if (result?.ok === false) throw new Error(result.error || 'A operação falhou.')
  return result
}

export function form(input: Record<string, unknown>) {
  const data = new FormData()
  for (const [key, value] of Object.entries(input)) if (value !== undefined) {
    data.set(key, Array.isArray(value) ? value.join(',') : value == null ? '' : String(value))
  }
  return data
}

export function define<S extends z.ZodRawShape>(
  name: string, description: string, permissionKey: PermissionKey | null, shape: S,
  mode: 'read' | 'create' | 'change',
  handler: (ctx: AgentContext, input: z.output<z.ZodObject<S>>) => Promise<unknown>,
  preview?: (ctx: AgentContext, input: z.output<z.ZodObject<S>>) => Promise<unknown>,
) {
  const schema = z.object(shape).strict()
  const tool: ToolDef<unknown> = {
    name, description: description + (mode === 'change' ? ' Retorna uma solicitação de autorização: comunique no chat os dados e o aviso de irreversibilidade e peça ao usuário que aprove no link. Não executa antes da aprovação.' : ''),
    permissionKey, riskLevel: mode === 'read' ? 'READ' : mode === 'create' ? 'LOW' : 'HIGH',
    requiresApproval: mode === 'change',
    handler: async (ctx, input) => handler(ctx, schema.parse(input)),
    ...(preview ? { prepare: async (ctx: AgentContext, input: unknown) => {
      await actionContext(ctx)
      return preview(ctx, schema.parse(input))
    } } : {}),
  }
  return { tool, inputShape: shape }
}

export async function list(ctx: AgentContext, table: string, columns: string, input: { limit: number; offset: number; search?: string; status?: string; startDate?: string; endDate?: string }, dateColumn = 'created_at', nameColumn?: string) {
  let query = createAdminClient().from(table).select(columns, { count: 'exact' }).eq('organization_id', ctx.orgId)
  if (input.search && nameColumn) query = query.ilike(nameColumn, `%${input.search.replace(/[%_\\]/g, '\\$&')}%`)
  if (input.status) query = query.eq('status', input.status)
  if (input.startDate) query = query.gte(dateColumn, input.startDate)
  if (input.endDate) query = query.lte(dateColumn, dateColumn === 'created_at' ? input.endDate + 'T23:59:59.999Z' : input.endDate)
  const { data, count, error } = await query.order(dateColumn, { ascending: false }).order('id').range(input.offset, input.offset + input.limit - 1)
  if (error) throw new Error(error.message)
  return { records: data, total: count, nextOffset: input.offset + (data?.length ?? 0) < (count ?? 0) ? input.offset + input.limit : null }
}
