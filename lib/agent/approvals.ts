import { createAdminClient } from '@/lib/supabase/server'
import { agentCanAccess, type AgentContext } from '@/lib/agent/context'
import { hasCapability } from '@/lib/capabilities/resolve.server'
import { TOOL_REGISTRY } from '@/lib/agent/tools/registry'
import { logAiExecution } from '@/lib/agent/audit'
import type { MemberRole, Permissions } from '@/lib/permissions'

/**
 * Approval flow assíncrono (issue #51) — o que lib/agent/execute.ts::executeTool()
 * chama quando `tool.requiresApproval` é true, em vez de bloquear a ação
 * dizendo "ainda não suportado" (nenhuma tool declara isso hoje; esta infra
 * fica pronta pra quando uma passar a exigir).
 */

export type PendingApproval = {
  id: string
  organization_id: string
  user_id: string
  agent_label: string
  tool: string
  input: Record<string, unknown> | null
  status: 'pending' | 'approved' | 'rejected'
  reviewed_by: string | null
  reviewed_at: string | null
  review_note: string | null
  result: unknown
  created_at: string
}

/** Enfileira uma ação pendente de aprovação — chamado dentro do Execution
 *  Engine, nunca diretamente por um caller externo. */
export async function enqueueApproval(params: { ctx: AgentContext; tool: string; input: unknown }): Promise<{ id: string }> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('agent_pending_approvals')
    .insert({
      organization_id: params.ctx.orgId,
      user_id: params.ctx.userId,
      agent_label: params.ctx.agentLabel,
      tool: params.tool,
      input: (params.input as Record<string, unknown>) ?? null,
    })
    .select('id')
    .single()
  return { id: data?.id }
}

/**
 * Aprova (reexecuta o handler original) ou rejeita (só marca) uma ação
 * pendente. Segurança: reconstrói o contexto a partir do `user_id` que
 * disparou a execução ORIGINAL (não do revisor) e revalida
 * permissão/capability na hora — a aprovação humana confirma A AÇÃO, nunca
 * eleva o acesso de quem a disparou. Se a permissão não existe mais (ex.:
 * usuário perdeu acesso ao módulo entre o pedido e a revisão), a execução é
 * recusada mesmo já aprovada pelo revisor.
 *
 * A transição pending -> approved/rejected é um UPDATE ... WHERE
 * status='pending' atômico (claim): se dois revisores aprovarem a mesma
 * linha ao mesmo tempo, só um efetivamente transiciona o status e executa
 * o handler — o outro vê 0 linhas afetadas e para sem duplicar a ação
 * (achado da revisão automática da PR #52).
 */
export async function resolvePendingApproval(
  approvalId: string,
  organizationId: string,
  decision: 'approved' | 'rejected',
  reviewedBy: string,
  reviewNote?: string,
): Promise<{ ok: true; executed: boolean } | { ok: false; error: string }> {
  const supabase = createAdminClient()
  const reviewedAt = new Date().toISOString()

  const { data: approval } = await supabase
    .from('agent_pending_approvals')
    .update({ status: decision, reviewed_by: reviewedBy, reviewed_at: reviewedAt, review_note: reviewNote ?? null })
    .eq('id', approvalId)
    .eq('organization_id', organizationId)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle()

  if (!approval) {
    const { data: existing } = await supabase
      .from('agent_pending_approvals')
      .select('id')
      .eq('id', approvalId)
      .eq('organization_id', organizationId)
      .maybeSingle()
    return { ok: false, error: existing ? 'Esta aprovação já foi revisada.' : 'Aprovação não encontrada.' }
  }

  if (decision === 'rejected') {
    return { ok: true, executed: false }
  }

  const setResult = (result: { ok: boolean; error?: string; data?: unknown }) =>
    supabase.from('agent_pending_approvals').update({ result }).eq('id', approvalId)

  const [{ data: org }, { data: membership }] = await Promise.all([
    supabase.from('organizations').select('id, slug, niche, account_id').eq('id', organizationId).maybeSingle(),
    supabase.from('memberships').select('role, permissions').eq('organization_id', organizationId).eq('user_id', approval.user_id).maybeSingle(),
  ])
  if (!org || !membership) {
    const error = 'Usuário que pediu a ação não pertence mais à organização.'
    await setResult({ ok: false, error })
    return { ok: false, error }
  }

  const ctx: AgentContext = {
    orgId: org.id,
    orgSlug: org.slug,
    accountId: (org as { account_id?: string | null }).account_id ?? null,
    niche: (org as { niche?: string | null }).niche ?? null,
    userId: approval.user_id,
    role: membership.role as MemberRole,
    permissions: (membership.permissions ?? {}) as Permissions,
    agentLabel: approval.agent_label,
  }

  const entry = TOOL_REGISTRY.find(({ tool }) => tool.name === approval.tool)
  if (!entry) {
    const error = 'Ferramenta não existe mais.'
    await setResult({ ok: false, error })
    return { ok: false, error }
  }

  if (!agentCanAccess(ctx, entry.tool.permissionKey)) {
    const error = 'Usuário não tem mais permissão pra este módulo.'
    await setResult({ ok: false, error })
    return { ok: false, error }
  }

  if (entry.tool.capabilityKey) {
    const capability = await hasCapability({ accountId: ctx.accountId, niche: ctx.niche, role: ctx.role, permissions: ctx.permissions }, entry.tool.capabilityKey)
    if (!capability.allowed) {
      await setResult({ ok: false, error: capability.reason })
      return { ok: false, error: capability.reason }
    }
  }

  let outcome: { ok: true; data: unknown } | { ok: false; error: string }
  try {
    const data = await entry.tool.handler(ctx, approval.input)
    outcome = { ok: true, data }
  } catch (e: any) {
    outcome = { ok: false, error: e?.message || 'Erro desconhecido.' }
  }

  await setResult(outcome)
  await logAiExecution({
    organizationId: ctx.orgId,
    userId: ctx.userId,
    agentLabel: ctx.agentLabel,
    tool: entry.tool.name,
    input: approval.input,
    status: outcome.ok ? 'success' : 'error',
    error: outcome.ok ? undefined : outcome.error,
  })

  // Propaga a falha de execução pro caller (UI) em vez de reportar sucesso
  // só porque o REVISOR aprovou — "aprovado" e "executado com sucesso" são
  // coisas diferentes (achado da revisão automática da PR #52).
  if (!outcome.ok) return { ok: false, error: outcome.error }
  return { ok: true, executed: true }
}
