// Server-only. Lê/escreve account_verticals (migration 0263) — o registro de
// "esta conta tem a vertical X" separado do campo imutável
// organizations.niche (ver comentário da migration pro porquê).
//
// NENHUMA função aqui decide sozinha SE uma conta pode ganhar uma vertical
// (isso é decisão de produto/pagamento, issue #32 completa, ainda não
// implementada) — são operações de registro. O caller é responsável por
// checar autorização (isAccountManager para concessão por admin da própria
// conta, isSuperAdmin para concessão manual do Super Admin — #33) antes de
// chamar grantAccountVertical.

import { createAdminClient } from '@/lib/supabase/server'
import type { NicheKey } from '@/lib/niche'
import type { EntitlementState } from '@/lib/capabilities/entitlement-state'

export interface AccountVertical {
  id: string
  accountId: string
  vertical: NicheKey
  status: EntitlementState
  grantedBy: string | null
  grantedReason: string
  activatedAt: string | null
  canceledAt: string | null
}

function mapRow(row: any): AccountVertical {
  return {
    id: row.id,
    accountId: row.account_id,
    vertical: row.vertical,
    status: row.status,
    grantedBy: row.granted_by,
    grantedReason: row.granted_reason,
    activatedAt: row.activated_at,
    canceledAt: row.canceled_at,
  }
}

export async function getAccountVerticals(accountId: string): Promise<AccountVertical[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('account_verticals')
    .select('id, account_id, vertical, status, granted_by, granted_reason, activated_at, canceled_at')
    .eq('account_id', accountId)
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapRow)
}

/**
 * Registra a concessão de uma vertical pra uma conta. `reason` é obrigatório
 * (CHECK NOT NULL na tabela) — nunca chame isto sem uma origem real (ex.:
 * "compra self-service via CheckoutModal #<id>" ou "concessão manual —
 * Super Admin, ticket #123"). Idempotente por (account_id, vertical): uma
 * segunda chamada atualiza a linha existente em vez de duplicar.
 */
export async function grantAccountVertical(params: {
  accountId: string
  vertical: NicheKey
  grantedBy: string | null
  reason: string
}): Promise<AccountVertical> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('account_verticals')
    .upsert(
      {
        account_id: params.accountId,
        vertical: params.vertical,
        status: 'active',
        granted_by: params.grantedBy,
        granted_reason: params.reason,
        activated_at: new Date().toISOString(),
        canceled_at: null,
      },
      { onConflict: 'account_id,vertical' },
    )
    .select('id, account_id, vertical, status, granted_by, granted_reason, activated_at, canceled_at')
    .single()
  if (error) throw new Error(error.message)
  return mapRow(data)
}

/**
 * Marca a vertical como pending_cancellation (não apaga dados operacionais
 * — issue #32: "Cancelar vertical não apaga automaticamente os dados
 * operacionais"). Transição pra 'inactive' de fato é responsabilidade de um
 * job de billing (fora de escopo desta fundação), não desta função.
 */
export async function requestAccountVerticalCancellation(accountId: string, vertical: NicheKey): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin
    .from('account_verticals')
    .update({ status: 'pending_cancellation', canceled_at: new Date().toISOString() })
    .eq('account_id', accountId)
    .eq('vertical', vertical)
  if (error) throw new Error(error.message)
}
