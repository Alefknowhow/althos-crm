import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import type { ToolDef } from '@/lib/agent/execute'

/**
 * Tools bespoke de templates de Projeto (issue #17 §7 — Especialista de
 * Projetos). Não importa actions/project-templates.ts: tools do Agent Layer
 * rodam tanto no Orquestrador (request com sessão) quanto no MCP externo
 * (token, sem cookies) — sempre createAdminClient() + ctx.orgId/userId
 * explícitos, nunca o client baseado em cookies das Server Actions (mesmo
 * padrão de lib/agent/tools/tasks.ts).
 */

export const listProjectTemplatesShape = {}

export const listProjectTemplatesTool: ToolDef<Record<string, never>> = {
  name: 'list_project_templates',
  description: 'Lista os templates de projeto disponíveis na organização (nome, descrição, quantidade de passos).',
  riskLevel: 'READ',
  requiresApproval: false,
  permissionKey: 'projects',
  handler: async ctx => {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('project_templates')
      .select('id, name, description, steps')
      .eq('organization_id', ctx.orgId)
      .order('name', { ascending: true })
    if (error) throw new Error(error.message)
    return (data || []).map((t: any) => ({ id: t.id, name: t.name, description: t.description, stepsCount: (t.steps || []).length }))
  },
}

export const applyProjectTemplateShape = {
  templateId: z.string().describe('UUID do template (ver list_project_templates)'),
  name: z.string().min(1).describe('Nome do novo projeto'),
  client_id: z.string().uuid().optional().describe('Contato/cliente a vincular (opcional — projeto pode ser de uso interno)'),
  owner_id: z.string().uuid().optional().describe('Responsável (padrão: quem está conversando)'),
  start_date: z.string().describe('YYYY-MM-DD — data de referência pros prazos relativos dos passos do template'),
  confirm: z.boolean().optional().describe('Só cria de fato com confirm:true — sem isso, devolve um preview do que seria criado.'),
}

export const applyProjectTemplateTool: ToolDef<{
  templateId: string; name: string; client_id?: string; owner_id?: string; start_date: string; confirm?: boolean
}> = {
  name: 'apply_project_template',
  description: 'Aplica um template de projeto: cria 1 Projeto + N Tasks reais com prazos relativos à data de referência. Sem confirm:true, retorna um preview (nome do projeto + tasks com datas calculadas) — confirme com o usuário no chat e só chame de novo com confirm:true depois de uma confirmação explícita dele.',
  riskLevel: 'MEDIUM',
  requiresApproval: false,
  permissionKey: 'projects',
  handler: async (ctx, input) => {
    const supabase = createAdminClient()

    const { data: template, error: tplErr } = await supabase
      .from('project_templates')
      .select('id, name, steps')
      .eq('id', input.templateId)
      .eq('organization_id', ctx.orgId)
      .maybeSingle()
    if (tplErr) throw new Error(tplErr.message)
    if (!template) throw new Error(`Template "${input.templateId}" não encontrado.`)

    const baseDate = new Date(`${input.start_date}T00:00:00.000Z`)
    const steps = (template.steps || []) as { title: string; description?: string; offset_days?: number; priority?: string; group?: string }[]
    const preview = steps.map(s => {
      const d = new Date(baseDate)
      d.setUTCDate(d.getUTCDate() + (s.offset_days || 0))
      return { title: s.title, due_date: d.toISOString().split('T')[0], priority: s.priority || 'normal', group: s.group || null }
    })

    if (!input.confirm) {
      return {
        confirmationRequired: true,
        message: 'Confirme com o usuário no chat antes de criar o projeto e as tasks abaixo. Chame de novo com confirm:true só depois da confirmação explícita.',
        project: { name: input.name, client_id: input.client_id || null, start_date: input.start_date },
        tasksPreview: preview,
      }
    }

    const { data: column } = await supabase
      .from('project_columns')
      .select('id')
      .eq('organization_id', ctx.orgId)
      .order('position', { ascending: true })
      .limit(1)
      .maybeSingle()

    const { data: project, error: projErr } = await supabase.from('projetos').insert({
      organization_id: ctx.orgId,
      client_id: input.client_id || null,
      name: input.name,
      owner_id: input.owner_id || ctx.userId,
      column_id: column?.id || null,
      start_date: input.start_date,
      template_key: input.templateId,
      created_by: ctx.userId,
    }).select('id').single()
    if (projErr) throw new Error(projErr.message)

    const groupIdByName = new Map<string, string>()
    const groupNames = Array.from(new Set(steps.map(s => s.group).filter((g): g is string => !!g)))
    for (const [i, name] of Array.from(groupNames.entries())) {
      const { data: group } = await supabase.from('projeto_grupos').insert({
        organization_id: ctx.orgId, project_id: project.id, name, position: i,
      }).select('id').single()
      if (group) groupIdByName.set(name, group.id)
    }

    const { data: taskColumn } = await supabase
      .from('task_columns')
      .select('id')
      .eq('organization_id', ctx.orgId)
      .order('position', { ascending: true })
      .limit(1)
      .maybeSingle()

    const rows = steps.map(s => {
      const d = new Date(baseDate)
      d.setUTCDate(d.getUTCDate() + (s.offset_days || 0))
      return {
        organization_id: ctx.orgId,
        title: s.title,
        description: s.description || null,
        due_date: d.toISOString(),
        priority: s.priority || 'normal',
        status: 'open',
        column_id: taskColumn?.id || null,
        project_id: project.id,
        project_group_id: s.group ? groupIdByName.get(s.group) || null : null,
        assigned_to: input.owner_id || ctx.userId,
      }
    })
    if (rows.length > 0) {
      const { error: tasksErr } = await supabase.from('tasks').insert(rows)
      if (tasksErr) throw new Error(tasksErr.message)
    }

    await supabase.from('project_activities').insert({
      organization_id: ctx.orgId, project_id: project.id, type: 'template_applied',
      payload: { name: template.name, tasksCreated: rows.length }, created_by: ctx.userId,
    })

    return { id: project.id, name: input.name, tasksCreated: rows.length }
  },
}
