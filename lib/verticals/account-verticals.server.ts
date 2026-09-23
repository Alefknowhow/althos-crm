// Server-only. Lê account_verticals (migration 0263) — o registro de "esta
// conta tem a vertical X" separado do campo imutável organizations.niche
// (ver comentário da migration pro porquê).
//
// Escrita NÃO vive aqui — as mutações de account_verticals (concessão,
// revogação) precisam acontecer na mesma transação que o insert em
// super_admin_audit_log (auditoria de mudança sensível não pode ficar
// "melhor esforço", achado da revisão automática da PR #38), o que exige
// uma RPC (admin_grant_account_vertical/admin_revoke_account_vertical,
// migration 0266) em vez de duas chamadas PostgREST separadas. Ver
// actions/super-admin-verticals.ts pros callers reais.

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
