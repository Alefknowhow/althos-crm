import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import type { ToolDef } from '@/lib/agent/execute'
import type { PermissionKey } from '@/lib/permissions'

/**
 * Etapa 4 (Agent Layer) — CRUD genérico por módulo. Em vez de escrever um
 * handler bespoke por tabela, cada módulo é uma config declarativa
 * (`ModuleConfig`) e essa fábrica gera as 5 tools padrão (list/get/create/
 * update/delete) a partir dela — é assim que "todos os módulos" viram
 * tools sem precisar de um arquivo por módulo. Módulos com regras de
 * escrita mais complexas continuam tendo tools bespoke em arquivos
 * próprios (ex.: clients.ts, campaigns.ts) — a fábrica não substitui isso,
 * só cobre o CRUD simples que sobra.
 *
 * Update/delete SEMPRE pedem confirmação explícita: sem `confirm: true` no
 * input, o handler devolve um preview + aviso em vez de executar, e a
 * descrição da tool instrui o agente a repassar esse aviso pro usuário no
 * chat antes de chamar de novo com `confirm: true`. Não existe estado de
 * aprovação no servidor (o transporte MCP aqui é stateless — um
 * McpServer novo por request), então o "confirm" no input é o mecanismo
 * real de segurança, não decoração.
 */

export type ModuleConfig = {
  /** Vira o sufixo do nome de cada tool: list_<key>, get_<key>, etc. */
  key: string
  table: string
  label: string
  permissionKey: PermissionKey
  /** Colunas seguras pra devolver (nunca 'select *' — evita vazar coluna
   *  sensível nova que alguém adicione na tabela sem pensar no agente). */
  selectColumns: string
  searchColumn?: string
  orderBy?: { column: string; ascending?: boolean }
  /** Campos que o agente pode setar em create/update — allowlist, nunca
   *  repassa o input bruto pro Supabase. */
  writableFields: string[]
  requiredCreateFields?: string[]
  /** false = omite a tool de delete inteiramente (ex.: registros que só
   *  fazem sentido como histórico, nunca apagados via agente). */
  deletable?: boolean
  /** false = omite create/update (ex.: submissões de formulário público —
   *  só faz sentido consultar ou excluir, nunca o agente "preencher"). */
  creatable?: boolean
  updatable?: boolean
}

const CONFIRM_NOTE = 'Ação IRREVERSÍVEL. Sem confirm:true, retorna um preview do que seria alterado/apagado — pergunte ao usuário no chat e só chame de novo com confirm:true depois de uma confirmação explícita dele.'

function pick(input: Record<string, any>, fields: string[]): Record<string, any> {
  const out: Record<string, any> = {}
  for (const f of fields) if (f in input && input[f] !== undefined) out[f] = input[f]
  return out
}

export function buildModuleTools(cfg: ModuleConfig): { tool: ToolDef<any>; inputShape: Record<string, any> }[] {
  const supabase = () => createAdminClient()

  const listShape: Record<string, any> = {
    limit: z.number().int().min(1).max(100).optional().describe('Máximo de resultados (padrão 50)'),
    offset: z.number().int().min(0).optional(),
  }
  if (cfg.searchColumn) listShape.search = z.string().optional().describe(`Busca em ${cfg.searchColumn}`)
  const listTool: ToolDef<{ search?: string; limit?: number; offset?: number }> = {
    name: `list_${cfg.key}`,
    description: `Lista registros de ${cfg.label}.`,
    riskLevel: 'READ',
    requiresApproval: false,
    permissionKey: cfg.permissionKey,
    handler: async (ctx, input) => {
      let q = supabase().from(cfg.table).select(cfg.selectColumns).eq('organization_id', ctx.orgId)
      if (cfg.searchColumn && input.search) q = q.ilike(cfg.searchColumn, `%${input.search}%`)
      if (cfg.orderBy) q = q.order(cfg.orderBy.column, { ascending: cfg.orderBy.ascending ?? true })
      q = q.range(input.offset || 0, (input.offset || 0) + (input.limit || 50) - 1)
      const { data, error } = await q
      if (error) throw new Error(error.message)
      return data
    },
  }

  const getShape = { id: z.string().describe('UUID do registro') }
  const getTool: ToolDef<{ id: string }> = {
    name: `get_${cfg.key}`,
    description: `Retorna um registro de ${cfg.label} pelo id.`,
    riskLevel: 'READ',
    requiresApproval: false,
    permissionKey: cfg.permissionKey,
    handler: async (ctx, input) => {
      const { data, error } = await supabase().from(cfg.table).select(cfg.selectColumns)
        .eq('organization_id', ctx.orgId).eq('id', input.id).maybeSingle()
      if (error) throw new Error(error.message)
      if (!data) throw new Error(`${cfg.label} "${input.id}" não encontrado.`)
      return data
    },
  }

  const createShape = { data: z.record(z.string(), z.any()).describe(`Campos permitidos: ${cfg.writableFields.join(', ')}`) }
  const createTool: ToolDef<{ data: Record<string, any> }> = {
    name: `create_${cfg.key}`,
    description: `Cria um registro de ${cfg.label}. Reversível (pode ser excluído depois).`,
    riskLevel: 'LOW',
    requiresApproval: false,
    permissionKey: cfg.permissionKey,
    handler: async (ctx, input) => {
      const patch = pick(input.data || {}, cfg.writableFields)
      for (const f of cfg.requiredCreateFields || []) {
        if (patch[f] === undefined) throw new Error(`Campo obrigatório ausente: ${f}`)
      }
      const { data, error } = await supabase().from(cfg.table)
        .insert({ ...patch, organization_id: ctx.orgId }).select(cfg.selectColumns).single()
      if (error) throw new Error(error.message)
      return data
    },
  }

  const updateShape = {
    id: z.string().describe('UUID do registro'),
    data: z.record(z.string(), z.any()).describe(`Campos permitidos: ${cfg.writableFields.join(', ')}`),
    confirm: z.boolean().optional().describe('Só executa a reescrita com confirm:true — ver descrição da tool.'),
  }
  const updateTool: ToolDef<{ id: string; data: Record<string, any>; confirm?: boolean }> = {
    name: `update_${cfg.key}`,
    description: `Atualiza (reescreve) campos de um registro de ${cfg.label}. ${CONFIRM_NOTE}`,
    riskLevel: 'MEDIUM',
    requiresApproval: false,
    permissionKey: cfg.permissionKey,
    handler: async (ctx, input) => {
      const patch = pick(input.data || {}, cfg.writableFields)
      if (Object.keys(patch).length === 0) throw new Error('Nenhum campo permitido em "data".')
      const { data: current, error: findErr } = await supabase().from(cfg.table).select(cfg.selectColumns)
        .eq('organization_id', ctx.orgId).eq('id', input.id).maybeSingle()
      if (findErr) throw new Error(findErr.message)
      if (!current) throw new Error(`${cfg.label} "${input.id}" não encontrado.`)

      if (!input.confirm) {
        return {
          confirmationRequired: true,
          message: `Confirme com o usuário no chat antes de reescrever este registro de ${cfg.label} — a versão anterior dos campos abaixo será perdida. Chame de novo com confirm:true só depois da confirmação explícita.`,
          currentValues: pick(current as Record<string, any>, Object.keys(patch)),
          proposedValues: patch,
        }
      }

      const { data, error } = await supabase().from(cfg.table).update(patch)
        .eq('organization_id', ctx.orgId).eq('id', input.id).select(cfg.selectColumns).single()
      if (error) throw new Error(error.message)
      return data
    },
  }

  const tools: { tool: ToolDef<any>; inputShape: Record<string, any> }[] = [
    { tool: listTool, inputShape: listShape },
    { tool: getTool, inputShape: getShape },
  ]
  if (cfg.creatable !== false) tools.push({ tool: createTool, inputShape: createShape })
  if (cfg.updatable !== false) tools.push({ tool: updateTool, inputShape: updateShape })

  if (cfg.deletable !== false) {
    const deleteShape = {
      id: z.string().describe('UUID do registro'),
      confirm: z.boolean().optional().describe('Só executa a exclusão com confirm:true — ver descrição da tool.'),
    }
    const deleteTool: ToolDef<{ id: string; confirm?: boolean }> = {
      name: `delete_${cfg.key}`,
      description: `Exclui permanentemente um registro de ${cfg.label}. ${CONFIRM_NOTE}`,
      riskLevel: 'HIGH',
      requiresApproval: false,
      permissionKey: cfg.permissionKey,
      handler: async (ctx, input) => {
        const { data: current, error: findErr } = await supabase().from(cfg.table).select(cfg.selectColumns)
          .eq('organization_id', ctx.orgId).eq('id', input.id).maybeSingle()
        if (findErr) throw new Error(findErr.message)
        if (!current) throw new Error(`${cfg.label} "${input.id}" não encontrado.`)

        if (!input.confirm) {
          return {
            confirmationRequired: true,
            message: `Confirme com o usuário no chat antes de excluir este registro de ${cfg.label} — não pode ser desfeito. Chame de novo com confirm:true só depois da confirmação explícita.`,
            record: current,
          }
        }

        const { error } = await supabase().from(cfg.table).delete()
          .eq('organization_id', ctx.orgId).eq('id', input.id)
        if (error) throw new Error(error.message)
        return { deleted: true, id: input.id }
      },
    }
    tools.push({ tool: deleteTool, inputShape: deleteShape })
  }

  return tools
}
