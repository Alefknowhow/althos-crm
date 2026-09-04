import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import type { RecurrenceFrequency } from '@/lib/financial/recurrence'

/**
 * Shared type + helpers for the actions/financial-*.ts modules
 * (financial.ts split by concern). No 'use server' here: these are plain
 * helpers called from server action files, not actions invoked directly
 * from the client, and a 'use server' file may only export async
 * functions -- FinancialEntryRow (a type) wouldn't be legal there.
 */

/** Auditoria (2026-08-23): as agregações read-only do dashboard (resumo,
 *  KPIs, fluxo de caixa, DRE, etc.) resolviam a org mas nunca checavam a
 *  permissão granular 'financial' — qualquer membro autenticado da
 *  organização conseguia ler dado financeiro completo via chamada direta
 *  da Server Action, independente da permissão concedida. */
export async function requireFinancialAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'financial')
  if (!check.allowed) throw new Error(check.reason || 'Sem permissão')
  return { org, user }
}

export type FinancialEntryRow = {
  id: string
  organization_id: string
  tipo: 'receita' | 'despesa'
  categoria: string
  subcategoria: string | null
  centro_custo: string | null
  conta_bancaria: string | null
  forma_pagamento: string | null
  valor_cents: number
  competencia: string
  vencimento: string | null
  data_pagamento: string | null
  status: 'pendente' | 'pago' | 'vencido' | 'cancelado'
  contato_id: string | null
  /** Nome do contato vinculado — só presente quando a query fizer o join
   *  (listFinancialEntries/getFinancialEntry); nunca gravado na tabela. */
  contato_nome?: string | null
  venda_id: string | null
  operadora: string | null
  /** Só em lançamentos gerados de reservas com comissão retida: 'retida'
   * (vencimento = data da venda) ou 'repasse' (vencimento = data da
   * operadora). Lançamentos manuais e reservas sem retenção ficam null. */
  commission_role: 'retida' | 'repasse' | null
  observacoes: string | null
  tags: string[]
  anexos: { path?: string; storage_object_id?: string; name: string; size_bytes: number; mime_type: string }[]
  is_recurring: boolean
  recurrence_group_id: string | null
  recurrence_frequency: RecurrenceFrequency | null
  recurrence_count: number | null
  recurrence_until: string | null
  recurrence_infinite: boolean
  installment_group_id: string | null
  parcela_numero: number | null
  parcela_total: number | null
  nota_fiscal: string | null
  numero_documento: string | null
  projeto: string | null
  unidade_negocio: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

/** "Vencido" não é um status gravado por um cron — é derivado na leitura:
 * um lançamento pendente cujo vencimento já passou aparece como vencido
 * pra quem consulta, sem precisar de job agendado. Se o usuário salvar o
 * lançamento nesse estado (mesmo sem mudar nada), o valor computado é
 * persistido normalmente via updateFinancialEntry. */
export function withEffectiveStatus<T extends { status: FinancialEntryRow['status']; vencimento: string | null }>(entry: T): T {
  if (entry.status === 'pendente' && entry.vencimento) {
    const today = new Date().toISOString().slice(0, 10)
    if (entry.vencimento < today) return { ...entry, status: 'vencido' }
  }
  return entry
}
