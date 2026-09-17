import type { createClient } from '@/lib/supabase/server'

/** Cria a linha de contrato em draft assim que um contato vira cliente
 *  (Agência↔Cliente, independente de vendas) — chamado tanto de
 *  createCustomer quanto de setContatoStatus (actions/contatos-contactpoints.ts),
 *  únicos dois pontos onde um contato passa a status='cliente'. */
export async function createDraftPlanContract(
  supabase: ReturnType<typeof createClient>,
  params: { organizationId: string; contatoId: string; userId: string },
) {
  await supabase.from('plan_contracts').insert({
    organization_id: params.organizationId,
    contato_id: params.contatoId,
    status: 'draft',
    created_by: params.userId,
  })
}
