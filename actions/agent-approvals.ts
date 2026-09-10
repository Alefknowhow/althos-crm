'use server'

import { isDeepStrictEqual } from 'node:util'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization, isImpersonating } from '@/lib/supabase/types'
import { resolveAgentTokenId, agentCanAccess } from '@/lib/agent/context'
import { TOOL_REGISTRY } from '@/lib/agent/tools/registry'
import { executeTool } from '@/lib/agent/execute'
import { revalidatePath } from 'next/cache'

export async function reviewAgentOperation(orgSlug: string, operationId: string, form: FormData) {
  z.string().uuid().parse(operationId)
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  if (isImpersonating()) throw new Error('Não é permitido aprovar em modo de impersonação.')
  const approve = form.get('decision') === 'approve'
  if (approve && form.get('understood') !== 'yes') throw new Error('Confirme que compreende a irreversibilidade.')
  const db = createAdminClient()
  // CAS: only one request can consume this approval, even on double-click/replay.
  const { data: request, error } = await db.from('agent_approval_requests')
    .update({ status: approve ? 'executing' : 'rejected', completed_at: approve ? null : new Date().toISOString() })
    .eq('id', operationId).eq('organization_id', org.id).eq('user_id', user.id).eq('status', 'pending')
    .gt('expires_at', new Date().toISOString()).select().maybeSingle()
  if (error || !request) throw new Error('Solicitação expirada, já processada ou não encontrada.')
  if (approve) {
    let result: { ok: boolean; data?: unknown; error?: string }
    try {
      const ctx = await resolveAgentTokenId(request.token_id)
      if (!ctx || ctx.orgId !== org.id || ctx.userId !== user.id) throw new Error('Token revogado ou acesso removido.')
      const entry = TOOL_REGISTRY.find(entry => entry.tool.name === request.tool)
      if (!entry?.tool.requiresApproval || !entry.tool.prepare) throw new Error('Operação não disponível para aprovação.')
      if (entry.tool.permissionKey && !agentCanAccess(ctx, entry.tool.permissionKey)) throw new Error('Permissão removida.')
      const preview = await entry.tool.prepare(ctx, request.input)
      if (!isDeepStrictEqual(preview, request.preview)) throw new Error('Os dados mudaram. Solicite uma nova operação no chat para revisar os valores atuais.')
      result = await executeTool(entry.tool, ctx, request.input, async () => true, () => resolveAgentTokenId(request.token_id))
    } catch (e) {
      result = { ok: false, error: e instanceof Error ? e.message : 'Falha ao executar a operação.' }
    }
    const { error: saveError } = await db.from('agent_approval_requests').update({
      status: result.ok ? 'succeeded' : 'failed', result: result.data ?? null, error: result.error ?? null, completed_at: new Date().toISOString(),
    }).eq('id', operationId).eq('organization_id', org.id).eq('user_id', user.id).eq('status', 'executing')
    if (saveError) throw new Error('Não foi possível salvar o resultado. A execução pode ter ocorrido; não repita sem conferir os dados.')
  }
  revalidatePath(`/app/${orgSlug}/mcp-aprovacoes/${operationId}`)
}
