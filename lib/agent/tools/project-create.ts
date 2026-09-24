import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import type { ToolDef } from '@/lib/agent/execute'

/**
 * create_projetos bespoke (issue #17) — substitui o create genérico de
 * modules-agenda.ts (creatable: false lá) só pra garantir column_id: o
 * mínimo documentado da tool genérica é `name`, e o handler genérico
 * (crud.ts) nunca chama ensureDefaultProjectColumnId, então um projeto
 * criado pelo orquestrador global/MCP externo nascia com column_id NULL —
 * invisível na visão Kanban (que filtra cards por coluna real). Mesmo
 * mecanismo de default de actions/project-columns.ts, sem importar Server
 * Actions (tools do Agent Layer rodam fora do request de página, sempre
 * createAdminClient() + ctx explícito).
 */

const WRITABLE_FIELDS = ['name', 'description', 'objective', 'client_id', 'owner_id', 'column_id', 'tags', 'health', 'start_date', 'due_date'] as const

export const createProjetoShape = {
  data: z.record(z.string(), z.any()).describe(`Campos permitidos: ${WRITABLE_FIELDS.join(', ')}`),
}

export const createProjetoTool: ToolDef<{ data: Record<string, any> }> = {
  name: 'create_projetos',
  description: 'Cria um registro de Projeto. Reversível (pode ser excluído depois).',
  riskLevel: 'LOW',
  requiresApproval: false,
  permissionKey: 'projects',
  handler: async (ctx, input) => {
    const supabase = createAdminClient()
    const patch: Record<string, any> = {}
    for (const f of WRITABLE_FIELDS) if (f in (input.data || {}) && input.data[f] !== undefined) patch[f] = input.data[f]
    if (!patch.name) throw new Error('Campo obrigatório ausente: name')

    if (!patch.column_id) {
      const { data: existing } = await supabase
        .from('project_columns')
        .select('id')
        .eq('organization_id', ctx.orgId)
        .order('position', { ascending: true })
        .limit(1)
        .maybeSingle()
      patch.column_id = existing?.id
        ?? (await supabase.from('project_columns').insert({ organization_id: ctx.orgId, name: 'A Fazer', position: 0 }).select('id').single()).data?.id
        ?? null
    }

    const { data, error } = await supabase.from('projetos')
      .insert({ ...patch, organization_id: ctx.orgId, owner_id: patch.owner_id || ctx.userId, created_by: ctx.userId })
      .select('id, name, description, objective, client_id, owner_id, column_id, tags, health, start_date, due_date, completed_at, archived_at, created_at')
      .single()
    if (error) throw new Error(error.message)
    return data
  },
}
