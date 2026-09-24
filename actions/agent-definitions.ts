'use server'

/**
 * CRUD de Agent Definitions (issue #46) — entidade configurável reutilizada
 * pelo Agent Runtime Invocation (lib/agent-definitions/invoke.ts). Gateado
 * pela permissão 'settings' porque controla quais tools um agente de IA
 * pode tentar chamar em nome da org — mais sensível que config comum.
 *
 * Sem UI própria ainda nesta fatia (issue #46 entrega o backend; a
 * superfície de configuração chega junto com quem for consumir isto de
 * verdade — Orquestrador #48 / Atribuições #49).
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { z } from 'zod'
import type { AgentDefinition } from '@/lib/agent-definitions/types'

async function requireAgentDefinitionsAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'settings')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  return { ok: true as const, user, org }
}

// Campos sem .default() — base compartilhada. Zod v4 NÃO desliga .default()
// dentro de .partial() (achado da revisão automática da PR #52: um update
// parcial tipo {name: "Novo nome"} reaplicava os defaults de TODOS os
// campos ausentes, resetando silenciosamente allowed_tools/model/is_active
// etc. em qualquer edição). Por isso create e update usam schemas
// distintos: só o de criação declara defaults.
const AgentDefinitionFields = {
  key: z.string().trim().min(1).max(60).regex(/^[a-z0-9_-]+$/, 'Use letras minúsculas, números, "-" ou "_".'),
  name: z.string().trim().min(1).max(120),
  role_label: z.string().trim().max(120).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  personality: z.string().trim().max(4000).optional().nullable(),
  persona: z.string().trim().max(4000).optional().nullable(),
  tone: z.string().trim().min(1).max(60),
  language: z.string().trim().min(1).max(20),
  objective: z.string().trim().max(2000).optional().nullable(),
  success_criteria: z.string().trim().max(2000).optional().nullable(),
  rules: z.string().trim().max(4000).optional().nullable(),
  additional_instructions: z.string().trim().max(4000).optional().nullable(),
  handoff_conditions: z.string().trim().max(2000).optional().nullable(),
  autonomy_limits: z.record(z.string(), z.unknown()),
  knowledge: z.string().trim().max(8000).optional().nullable(),
  allowed_tools: z.array(z.string()),
  allowed_skills: z.array(z.string()),
  model: z.string().trim().min(1).max(60),
  is_active: z.boolean(),
}

const AgentDefinitionCreateInput = z.object(AgentDefinitionFields).extend({
  tone: z.string().trim().min(1).max(60).default('profissional'),
  language: z.string().trim().min(1).max(20).default('pt-BR'),
  autonomy_limits: z.record(z.string(), z.unknown()).default({}),
  allowed_tools: z.array(z.string()).default([]),
  allowed_skills: z.array(z.string()).default([]),
  model: z.string().trim().min(1).max(60).default('claude-haiku-4-5'),
  is_active: z.boolean().default(true),
})

// Sem .default() em nenhum campo — .partial() aqui nunca reintroduz um
// valor que o caller não mandou.
const AgentDefinitionUpdateInput = z.object(AgentDefinitionFields).partial()

export type AgentDefinitionInputType = z.infer<typeof AgentDefinitionCreateInput>

export async function listAgentDefinitions(orgSlug: string): Promise<{ ok: true; items: AgentDefinition[] } | { ok: false; error: string }> {
  const access = await requireAgentDefinitionsAccess(orgSlug)
  if (!access.ok) return access

  const supabase = createClient()
  const { data, error } = await supabase
    .from('agent_definitions')
    .select('*')
    .eq('organization_id', access.org.id)
    .order('created_at', { ascending: true })

  if (error) return { ok: false, error: error.message }
  return { ok: true, items: (data ?? []) as AgentDefinition[] }
}

export async function getAgentDefinition(orgSlug: string, id: string): Promise<{ ok: true; item: AgentDefinition } | { ok: false; error: string }> {
  const access = await requireAgentDefinitionsAccess(orgSlug)
  if (!access.ok) return access

  const supabase = createClient()
  const { data, error } = await supabase
    .from('agent_definitions')
    .select('*')
    .eq('organization_id', access.org.id)
    .eq('id', id)
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: 'Agent Definition não encontrado.' }
  return { ok: true, item: data as AgentDefinition }
}

export async function createAgentDefinition(orgSlug: string, input: unknown): Promise<{ ok: true; item: AgentDefinition } | { ok: false; error: string }> {
  const access = await requireAgentDefinitionsAccess(orgSlug)
  if (!access.ok) return access

  const parsed = AgentDefinitionCreateInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message || 'Dados inválidos.' }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('agent_definitions')
    .insert({ ...parsed.data, organization_id: access.org.id, created_by: access.user.id })
    .select('*')
    .single()

  if (error) {
    if (error.code === '23505') return { ok: false, error: `Já existe um Agent Definition com a chave "${parsed.data.key}" nesta organização.` }
    return { ok: false, error: error.message }
  }
  return { ok: true, item: data as AgentDefinition }
}

export async function updateAgentDefinition(orgSlug: string, id: string, input: unknown): Promise<{ ok: true; item: AgentDefinition } | { ok: false; error: string }> {
  const access = await requireAgentDefinitionsAccess(orgSlug)
  if (!access.ok) return access

  const parsed = AgentDefinitionUpdateInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message || 'Dados inválidos.' }
  if (Object.keys(parsed.data).length === 0) return { ok: false, error: 'Nada para atualizar.' }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('agent_definitions')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('organization_id', access.org.id)
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Já existe um Agent Definition com essa chave nesta organização.' }
    return { ok: false, error: error.message }
  }
  if (!data) return { ok: false, error: 'Agent Definition não encontrado.' }
  return { ok: true, item: data as AgentDefinition }
}

export async function deleteAgentDefinition(orgSlug: string, id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await requireAgentDefinitionsAccess(orgSlug)
  if (!access.ok) return access

  const supabase = createClient()
  const { error } = await supabase
    .from('agent_definitions')
    .delete()
    .eq('organization_id', access.org.id)
    .eq('id', id)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
