'use server'

import { z } from 'zod'
import { createHash, randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'

/**
 * Etapa 3 (Agent Layer) — Personal Access Tokens que autenticam Claude
 * Code/Codex/outros agentes MCP como um usuário do CRM. Mesmo padrão de
 * hashing de actions/mfa.ts (sha256, nunca guarda o valor puro).
 */

export type AgentToken = {
  id: string
  name: string
  agent_label: 'claude_code' | 'codex' | 'outro'
  token_prefix: string
  last_used_at: string | null
  revoked_at: string | null
  created_at: string
}

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

function makeToken(): string {
  return `althos_${randomBytes(24).toString('hex')}`
}

async function requireAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'settings')
  if (!check.allowed) throw new Error(check.reason || 'Sem permissão')
  return { org, user }
}

export async function listAgentTokens(orgSlug: string): Promise<AgentToken[]> {
  const { org, user } = await requireAccess(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('agent_tokens')
    .select('id, name, agent_label, token_prefix, last_used_at, revoked_at, created_at')
    .eq('organization_id', org.id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  return (data as AgentToken[]) || []
}

const CreateSchema = z.object({
  name: z.string().min(1).max(80),
  agentLabel: z.enum(['claude_code', 'codex', 'outro']),
})

export async function createAgentToken(orgSlug: string, raw: unknown) {
  const { org, user } = await requireAccess(orgSlug)
  const parsed = CreateSchema.safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: 'Dados inválidos: ' + parsed.error.issues[0]?.message }

  const token = makeToken()
  const supabase = createClient()
  const { error } = await supabase.from('agent_tokens').insert({
    organization_id: org.id,
    user_id: user.id,
    name: parsed.data.name,
    agent_label: parsed.data.agentLabel,
    token_hash: hashToken(token),
    token_prefix: token.slice(0, 16),
    created_by: user.id,
  })
  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/configuracoes/agentes`)
  // O valor puro só existe nesta resposta — nunca mais é recuperável.
  return { ok: true as const, token }
}

export async function revokeAgentToken(orgSlug: string, id: string) {
  const { org, user } = await requireAccess(orgSlug)
  const supabase = createClient()
  const { error } = await supabase
    .from('agent_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id).eq('organization_id', org.id).eq('user_id', user.id)
  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/configuracoes/agentes`)
  return { ok: true as const }
}
