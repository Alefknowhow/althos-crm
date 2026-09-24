'use server'

/**
 * Templates de Agenda → Projetos (issue #17 §6) — aplicar um template cria
 * 1 Projeto real + N Tasks globais reais (tasks.project_id), com prazos
 * relativos a uma data de referência. Sem "template engine" genérico prévio
 * no repo — cálculo de prazo relativo mesmo espírito de
 * lib/inngest/automation-step-executor.ts (case 'create_task').
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { isAccessBlocked } from '@/lib/billing/plans'
import { projectTemplateSchema, applyProjectTemplateSchema, type ProjectTemplateInput, type ApplyProjectTemplateInput } from '@/lib/validators/project-template'
import { ensureDefaultProjectColumnId } from './project-columns'
import { ensureDefaultColumnId as ensureDefaultTaskColumnId } from './tasks-columns'
import { logProjectActivity } from './project-activities'
import { revalidatePath } from 'next/cache'

const FROZEN_ERROR = 'Conta em modo somente leitura (teste expirado ou assinatura cancelada). Assine um plano para continuar editando.'

export type ProjectTemplateRow = {
  id: string
  name: string
  description: string | null
  steps: ProjectTemplateInput['steps']
  created_at: string
}

export async function listProjectTemplates(orgSlug: string): Promise<ProjectTemplateRow[]> {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'projects')
  if (!check.allowed) throw new Error(check.reason)
  const supabase = createClient()
  const { data, error } = await supabase
    .from('project_templates')
    .select('id, name, description, steps, created_at')
    .eq('organization_id', org.id)
    .order('name', { ascending: true })
  if (error) throw new Error('Não foi possível carregar os templates de projeto')
  return (data || []) as ProjectTemplateRow[]
}

export async function getProjectTemplate(orgSlug: string, templateId: string): Promise<ProjectTemplateRow | null> {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'projects')
  if (!check.allowed) return null
  const supabase = createClient()
  const { data, error } = await supabase
    .from('project_templates')
    .select('id, name, description, steps, created_at')
    .eq('id', templateId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (error) return null
  return data as ProjectTemplateRow | null
}

export async function createProjectTemplate(orgSlug: string, input: ProjectTemplateInput) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  if (isAccessBlocked(org as any)) return { ok: false as const, error: FROZEN_ERROR }
  const check = await checkMemberPermission(org.id, user.id, 'projects')
  if (!check.allowed) return { ok: false as const, error: check.reason }
  const supabase = createClient()

  const validation = projectTemplateSchema.safeParse(input)
  if (!validation.success) return { ok: false as const, error: validation.error.issues[0].message }
  const v = validation.data

  const { data, error } = await supabase.from('project_templates').insert({
    organization_id: org.id,
    name: v.name,
    description: v.description || null,
    steps: v.steps,
    created_by: user.id,
  }).select('id').single()

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/agenda/projetos`)
  return { ok: true as const, id: data.id as string }
}

export async function updateProjectTemplate(orgSlug: string, templateId: string, input: ProjectTemplateInput) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  if (isAccessBlocked(org as any)) return { ok: false as const, error: FROZEN_ERROR }
  const check = await checkMemberPermission(org.id, user.id, 'projects')
  if (!check.allowed) return { ok: false as const, error: check.reason }
  const supabase = createClient()

  const validation = projectTemplateSchema.safeParse(input)
  if (!validation.success) return { ok: false as const, error: validation.error.issues[0].message }
  const v = validation.data

  const { error } = await supabase.from('project_templates')
    .update({ name: v.name, description: v.description || null, steps: v.steps })
    .eq('id', templateId).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/agenda/projetos`)
  return { ok: true as const }
}

export async function deleteProjectTemplate(orgSlug: string, templateId: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  if (isAccessBlocked(org as any)) return { ok: false as const, error: FROZEN_ERROR }
  const check = await checkMemberPermission(org.id, user.id, 'projects')
  if (!check.allowed) return { ok: false as const, error: check.reason }
  const supabase = createClient()
  const { error } = await supabase.from('project_templates').delete().eq('id', templateId).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/agenda/projetos`)
  return { ok: true as const }
}

/** Cria o Projeto + uma Task por step, com due_date = start_date + offset_days.
 *  Steps com `group` distinto viram projeto_grupos (criados uma vez, mesma
 *  transação lógica). Não sobrescreve nada existente — é sempre criação nova. */
export async function applyProjectTemplate(orgSlug: string, templateId: string, input: ApplyProjectTemplateInput) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  if (isAccessBlocked(org as any)) return { ok: false as const, error: FROZEN_ERROR }
  const check = await checkMemberPermission(org.id, user.id, 'projects')
  if (!check.allowed) return { ok: false as const, error: check.reason }
  const supabase = createClient()

  const validation = applyProjectTemplateSchema.safeParse(input)
  if (!validation.success) return { ok: false as const, error: validation.error.issues[0].message }
  const v = validation.data

  const template = await getProjectTemplate(orgSlug, templateId)
  if (!template) return { ok: false as const, error: 'Template não encontrado.' }

  const columnId = await ensureDefaultProjectColumnId(supabase, org.id)
  const { data: project, error: projErr } = await supabase.from('projetos').insert({
    organization_id: org.id,
    client_id: v.client_id || null,
    name: v.name,
    owner_id: v.owner_id || user.id,
    column_id: columnId,
    start_date: v.start_date,
    template_key: templateId,
    created_by: user.id,
  }).select('id').single()
  if (projErr) return { ok: false as const, error: projErr.message }

  // Falha em qualquer etapa a partir daqui desfaz o projeto inteiro (apagar
  // projetos.id cai em cascata sobre projeto_grupos via ON DELETE CASCADE, e
  // nenhuma task chega a existir antes do insert final) — evita projeto
  // "fantasma" sem grupos/tasks se um passo intermediário falhar.
  const groupIdByName = new Map<string, string>()
  const groupNames = Array.from(new Set(template.steps.map(s => s.group).filter((g): g is string => !!g)))
  for (const [i, name] of Array.from(groupNames.entries())) {
    const { data: group, error: groupErr } = await supabase.from('projeto_grupos').insert({
      organization_id: org.id, project_id: project.id, name, position: i,
    }).select('id').single()
    if (groupErr || !group) {
      await supabase.from('projetos').delete().eq('id', project.id).eq('organization_id', org.id)
      return { ok: false as const, error: groupErr?.message || 'Erro ao criar grupo do template' }
    }
    groupIdByName.set(name, group.id)
  }

  const taskColumnId = await ensureDefaultTaskColumnId(supabase, org.id)
  const baseDate = new Date(`${v.start_date}T00:00:00.000Z`)
  const rows = template.steps.map(step => {
    const dueDate = new Date(baseDate)
    dueDate.setUTCDate(dueDate.getUTCDate() + (step.offset_days || 0))
    return {
      organization_id: org.id,
      title: step.title,
      description: step.description || null,
      due_date: dueDate.toISOString(),
      priority: step.priority || 'normal',
      status: 'open',
      column_id: taskColumnId,
      project_id: project.id,
      project_group_id: step.group ? groupIdByName.get(step.group) || null : null,
      assigned_to: v.owner_id || user.id,
    }
  })
  if (rows.length > 0) {
    const { error: tasksErr } = await supabase.from('tasks').insert(rows)
    if (tasksErr) {
      await supabase.from('projetos').delete().eq('id', project.id).eq('organization_id', org.id)
      return { ok: false as const, error: tasksErr.message }
    }
  }

  await logProjectActivity(supabase, {
    organizationId: org.id, projectId: project.id, type: 'template_applied',
    payload: { name: template.name, tasksCreated: rows.length }, userId: user.id,
  })

  revalidatePath(`/app/${orgSlug}/agenda/projetos`)
  return { ok: true as const, id: project.id as string, tasksCreated: rows.length }
}
