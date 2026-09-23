// Server-only. Ponto único de gravação em super_admin_audit_log (issue #33).
//
// Substitui os `await admin.from('super_admin_audit_log').insert({...})`
// espalhados por actions/super-admin-*.ts que NUNCA checavam o erro do
// insert — a auditoria #33 confirmou que isso vinha causando uma falha
// silenciosa real (a CHECK constraint original só aceitava
// impersonate_start/impersonate_end; toda outra ação falhava e ninguém
// notava). logAdminAction() joga o erro pra cima: se o log não grava, a
// ação inteira deve falhar — auditoria de mudança sensível não é
// "melhor esforço".

import { createAdminClient } from '@/lib/supabase/server'

export interface AdminActionLog {
  actorUserId: string
  action: string
  targetOrganizationId?: string | null
  targetAccountId?: string | null
  oldValue?: unknown
  newValue?: unknown
  /** Obrigatório para concessões manuais (issue #33: "concessão manual não
   *  cria compra fictícia. Registrar origem/motivo") — opcional para ações
   *  cujo motivo já é óbvio pelo próprio `action` (ex.: impersonate_start). */
  reason?: string | null
}

export async function logAdminAction(entry: AdminActionLog): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin.from('super_admin_audit_log').insert({
    super_admin_user_id: entry.actorUserId,
    action: entry.action,
    target_organization_id: entry.targetOrganizationId ?? null,
    target_account_id: entry.targetAccountId ?? null,
    old_value: entry.oldValue ?? null,
    new_value: entry.newValue ?? null,
    reason: entry.reason ?? null,
  })
  if (error) {
    throw new Error(`Falha ao gravar log de auditoria (ação "${entry.action}" NÃO foi registrada): ${error.message}`)
  }
}
