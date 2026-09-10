import { createAdminClient } from '@/lib/supabase/server'
import { define, id } from './crm-shared'

export const operationTools = [define('get_operation_status', 'Consulta o resultado de uma solicitação de edição/exclusão. Só retorna operações solicitadas pelo mesmo token e usuário. Nunca autoriza uma operação.',
  null, { operationId: id }, 'read', async (ctx, input) => {
    const { data, error } = await createAdminClient().from('agent_approval_requests')
      .select('id,tool,status,result,error,expires_at,completed_at')
      .eq('id', input.operationId).eq('organization_id', ctx.orgId).eq('user_id', ctx.userId).eq('token_id', ctx.tokenId).single()
    if (error || !data) throw new Error('Solicitação não encontrada.')
    return { ...data, status: data.status === 'pending' && new Date(data.expires_at).getTime() <= Date.now() ? 'expired' : data.status }
  })]
