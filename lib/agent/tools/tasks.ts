import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import type { ToolDef } from '@/lib/agent/execute'
import { ensureDefaultColumnId } from '@/actions/tasks'

async function resolveClientId(orgId: string, client: string): Promise<{ id: string; name: string } | null> {
  const supabase = createAdminClient()
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(client)
  const query = supabase.from('contatos').select('id, name').eq('organization_id', orgId).eq('status', 'cliente')
  const { data } = isUuid
    ? await query.eq('id', client).maybeSingle()
    : await query.ilike('name', `%${client}%`).limit(1).maybeSingle()
  return data
}

export const getTasksShape = {
  client: z.string().optional().describe('ID (UUID) ou nome do cliente — filtra tarefas ligadas a ele'),
  status: z.enum(['open', 'doing', 'done']).optional(),
}

export const getTasksTool: ToolDef<{ client?: string; status?: string }> = {
  name: 'get_tasks',
  description: 'Lista tarefas do workspace, opcionalmente filtradas por cliente e/ou status.',
  riskLevel: 'READ',
  requiresApproval: false,
  permissionKey: 'tasks',
  handler: async (ctx, input) => {
    const supabase = createAdminClient()
    let contatoId: string | undefined
    if (input.client) {
      const resolved = await resolveClientId(ctx.orgId, input.client)
      if (!resolved) throw new Error(`Cliente "${input.client}" não encontrado`)
      contatoId = resolved.id
    }

    let q = supabase
      .from('tasks')
      .select('id, title, description, due_date, priority, status, contato_id, assigned_to, created_at')
      .eq('organization_id', ctx.orgId)
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(100)

    if (contatoId) q = q.eq('contato_id', contatoId)
    if (input.status) q = q.eq('status', input.status)

    const { data } = await q
    return data || []
  },
}

export const createTaskShape = {
  client: z.string().optional().describe('ID (UUID) ou nome do cliente a associar (opcional)'),
  title: z.string().min(1).describe('Título da tarefa'),
  description: z.string().optional(),
  dueDate: z.string().optional().describe('YYYY-MM-DD'),
}

export const createTaskTool: ToolDef<{ client?: string; title: string; description?: string; dueDate?: string }> = {
  name: 'create_task',
  description: 'Cria uma tarefa administrativa, opcionalmente vinculada a um cliente. Ação de baixo risco, reversível (a tarefa pode ser excluída depois pela UI).',
  riskLevel: 'LOW',
  requiresApproval: false,
  permissionKey: 'tasks',
  handler: async (ctx, input) => {
    let contatoId: string | null = null
    if (input.client) {
      const resolved = await resolveClientId(ctx.orgId, input.client)
      if (!resolved) throw new Error(`Cliente "${input.client}" não encontrado`)
      contatoId = resolved.id
    }

    const supabase = createAdminClient()
    const columnId = await ensureDefaultColumnId(supabase, ctx.orgId)

    const { data, error } = await supabase.from('tasks').insert({
      organization_id: ctx.orgId,
      title: input.title,
      description: input.description || null,
      due_date: input.dueDate ? new Date(input.dueDate).toISOString() : null,
      priority: 'normal',
      contato_id: contatoId,
      assigned_to: ctx.userId,
      status: 'open',
      column_id: columnId,
    }).select('id').single()

    if (error) throw new Error(error.message)
    return { id: data.id, title: input.title }
  },
}
