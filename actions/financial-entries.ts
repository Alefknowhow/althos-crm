'use server'

import { getActionContext } from '@/lib/services/context'
import { createFinancialEntryCore,deleteFinancialEntryCore,updateFinancialEntryCore } from '@/lib/services/financial-entries'

/**
 * Financial entry CRUD (list/get/create/update/delete/bulk-create) and
 * AI category suggestion. Split out of actions/financial.ts.
 */

import { checkMemberPermission } from '@/lib/permissions.server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization,requireAuth } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'
import { withEffectiveStatus,type FinancialEntryRow } from './financial-shared'

/** Quantas ocorrências futuras gerar quando a recorrência não informa
 *  frequência explícita (retrocompatibilidade com o antigo checkbox binário
 *  "todo mês, 12x"). */






export async function listFinancialEntries(
  orgSlug: string,
  filters?: { tipo?: string; categoria?: string; status?: string; from?: string; to?: string; contatoId?: string },
): Promise<FinancialEntryRow[]> {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'financial')
  if (!perm.allowed) return []
  const supabase = createClient()
  let query = supabase
    .from('financial_entries')
    .select('*, contatos(name)')
    .eq('organization_id', org.id)

  if (filters?.tipo) query = query.eq('tipo', filters.tipo)
  if (filters?.categoria) query = query.eq('categoria', filters.categoria)
  if (filters?.contatoId) query = query.eq('contato_id', filters.contatoId)
  if (filters?.from) query = query.gte('competencia', filters.from)
  if (filters?.to) query = query.lte('competencia', filters.to)

  const today = new Date().toISOString().slice(0, 10)
  if (filters?.status === 'vencido') {
    query = query.or(`status.eq.vencido,and(status.eq.pendente,vencimento.lt.${today})`)
  } else if (filters?.status === 'pendente') {
    query = query.eq('status', 'pendente').or(`vencimento.is.null,vencimento.gte.${today}`)
  } else if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  const { data } = await query.order('competencia', { ascending: false }).limit(1000)
  return ((data as any[]) ?? []).map((r: any) => withEffectiveStatus({ ...r, contato_nome: r.contatos?.name ?? null }))
}

export async function getFinancialEntry(orgSlug: string, id: string): Promise<FinancialEntryRow | null> {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'financial')
  if (!perm.allowed) return null
  const supabase = createClient()
  const { data } = await supabase
    .from('financial_entries')
    .select('*, contatos(name)')
    .eq('organization_id', org.id)
    .eq('id', id)
    .maybeSingle()
  return data ? withEffectiveStatus({ ...(data as any), contato_nome: (data as any).contatos?.name ?? null } as FinancialEntryRow) : null
}

export async function createFinancialEntry(orgSlug: string, input: Record<string, any>) {
  return createFinancialEntryCore(await getActionContext(orgSlug), input)
}

export async function updateFinancialEntry(orgSlug: string, id: string, input: Record<string, any>) {
  return updateFinancialEntryCore(await getActionContext(orgSlug), id, input)
}

export async function deleteFinancialEntry(orgSlug: string, id: string) {
  return deleteFinancialEntryCore(await getActionContext(orgSlug), id)
}

/** Import em lote (CSV de extrato bancário). Linhas inválidas são ignoradas silenciosamente — a validação já ocorreu no preview do importador. */
export async function bulkCreateFinancialEntries(
  orgSlug: string,
  rows: { tipo: 'receita' | 'despesa'; categoria: string; valor_cents: number; competencia: string; observacoes?: string | null }[],
) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'financial')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const valid = rows.filter(r =>
    (r.tipo === 'receita' || r.tipo === 'despesa') && r.categoria?.trim() && r.valor_cents > 0 && r.competencia,
  )
  if (valid.length === 0) return { ok: false as const, error: 'Nenhuma linha válida para importar.' }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('financial_entries')
    .insert(valid.map(r => ({
      organization_id: org.id,
      created_by: user.id,
      tipo: r.tipo,
      categoria: r.categoria.trim(),
      valor_cents: Math.round(r.valor_cents),
      competencia: r.competencia,
      observacoes: r.observacoes?.trim() || null,
      status: 'pago' as const,
      data_pagamento: r.competencia,
    })))
    .select('id')

  if (error) return { ok: false as const, error: error.message || 'Erro ao importar lançamentos' }

  revalidatePath(`/app/${orgSlug}/financeiro`)
  return { ok: true as const, count: data?.length ?? 0 }
}

