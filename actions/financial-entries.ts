'use server'

/**
 * Financial entry CRUD (list/get/create/update/delete/bulk-create) and
 * AI category suggestion. Split out of actions/financial.ts.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization, isImpersonating } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'
import { deleteObject } from '@/actions/storage'
import {
  addMonthsIso, computeRecurrenceDates, computeInstallmentDates,
} from '@/lib/financial/recurrence'
import { withEffectiveStatus, type FinancialEntryRow } from './financial-shared'

/** Quantas ocorrências futuras gerar quando a recorrência não informa
 *  frequência explícita (retrocompatibilidade com o antigo checkbox binário
 *  "todo mês, 12x"). */
const RECURRING_MONTHS_AHEAD = 11

const WRITABLE = [
  'tipo', 'categoria', 'subcategoria', 'centro_custo', 'conta_bancaria', 'forma_pagamento',
  'valor_cents', 'competencia', 'vencimento', 'data_pagamento', 'status',
  'contato_id', 'venda_id', 'operadora', 'observacoes', 'tags', 'is_recurring',
  'recurrence_frequency', 'recurrence_count', 'recurrence_until', 'recurrence_infinite',
  'nota_fiscal', 'numero_documento', 'projeto', 'unidade_negocio',
] as const

function pick(input: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {}
  for (const k of WRITABLE) if (k in input) out[k] = input[k]
  if ('valor_cents' in out) {
    const n = Number(out.valor_cents)
    out.valor_cents = Number.isFinite(n) ? Math.round(n) : 0
  }
  for (const k of ['vencimento', 'data_pagamento'] as const) {
    if (k in out && !out[k]) out[k] = null
  }
  for (const k of ['contato_id', 'venda_id'] as const) {
    if (k in out && !out[k]) out[k] = null
  }
  return out
}

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
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'financial')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  if (input.tipo !== 'receita' && input.tipo !== 'despesa') {
    return { ok: false as const, error: 'Informe o tipo (receita ou despesa).' }
  }
  if (!input.categoria?.trim()) return { ok: false as const, error: 'Informe a categoria.' }
  if (!input.valor_cents || Number(input.valor_cents) <= 0) {
    return { ok: false as const, error: 'Informe um valor válido.' }
  }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('financial_entries')
    .insert({
      organization_id: org.id,
      created_by: user.id,
      ...pick(input),
    })
    .select()
    .single()

  if (error || !data) return { ok: false as const, error: error?.message || 'Erro ao criar lançamento' }

  // Despesa/receita recorrente: gera de uma vez as próximas ocorrências,
  // já pendentes, agrupadas pelo id do lançamento original — assim aparecem
  // prontas sem precisar recadastrar. Frequência explícita (recurrence_*)
  // tem prioridade; sem ela, cai no comportamento legado (mensal, 11x).
  if (data.is_recurring) {
    await supabase.from('financial_entries').update({ recurrence_group_id: data.id }).eq('id', data.id)

    const baseVencimento = data.vencimento || data.competencia
    const futureDates = data.recurrence_frequency
      ? computeRecurrenceDates(baseVencimento, {
          frequency: data.recurrence_frequency,
          count: data.recurrence_count,
          until: data.recurrence_until,
          infinite: data.recurrence_infinite,
        })
      : Array.from({ length: RECURRING_MONTHS_AHEAD }, (_, i) => addMonthsIso(baseVencimento, i + 1))

    const monthsFromVencimento = (target: string) => {
      // Desloca competência pelo mesmo número de dias que o vencimento andou,
      // pra manter o "mês de referência" coerente com o vencimento gerado.
      const diffDays = Math.round((new Date(target).getTime() - new Date(baseVencimento).getTime()) / 86_400_000)
      const d = new Date(data.competencia); d.setDate(d.getDate() + diffDays)
      return d.toISOString().slice(0, 10)
    }

    const future = futureDates.map(vencIso => ({
      organization_id: org.id,
      created_by: user.id,
      recurrence_group_id: data.id,
      is_recurring: true,
      recurrence_frequency: data.recurrence_frequency,
      recurrence_count: data.recurrence_count,
      recurrence_until: data.recurrence_until,
      recurrence_infinite: data.recurrence_infinite,
      tipo: data.tipo,
      categoria: data.categoria,
      subcategoria: data.subcategoria,
      centro_custo: data.centro_custo,
      conta_bancaria: data.conta_bancaria,
      forma_pagamento: data.forma_pagamento,
      valor_cents: data.valor_cents,
      competencia: monthsFromVencimento(vencIso),
      vencimento: data.vencimento ? vencIso : null,
      data_pagamento: null,
      status: 'pendente' as const,
      contato_id: data.contato_id,
      operadora: data.operadora,
      observacoes: data.observacoes,
      tags: data.tags ?? [],
    }))
    if (future.length > 0) await supabase.from('financial_entries').insert(future)
  }

  // Parcelamento — independente de recorrência. parcela_total vem preenchido
  // pelo formulário quando o usuário ativa "compra parcelada"; intervalo em
  // dias é passado à parte (não persiste, só usado na hora de gerar).
  const installmentTotal = Number(input.parcela_total) || 0
  if (installmentTotal > 1) {
    const groupId = data.id
    const intervalDays = Number(input.installment_interval_days) || 30
    const baseDate = data.vencimento || data.competencia
    const futureDates = computeInstallmentDates(baseDate, installmentTotal, intervalDays)

    await supabase.from('financial_entries').update({
      installment_group_id: groupId, parcela_numero: 1, parcela_total: installmentTotal,
    }).eq('id', data.id)

    const future = futureDates.map((vencIso, idx) => ({
      organization_id: org.id,
      created_by: user.id,
      installment_group_id: groupId,
      parcela_numero: idx + 2,
      parcela_total: installmentTotal,
      tipo: data.tipo,
      categoria: data.categoria,
      subcategoria: data.subcategoria,
      centro_custo: data.centro_custo,
      conta_bancaria: data.conta_bancaria,
      forma_pagamento: data.forma_pagamento,
      valor_cents: data.valor_cents,
      competencia: vencIso,
      vencimento: vencIso,
      data_pagamento: null,
      status: 'pendente' as const,
      contato_id: data.contato_id,
      operadora: data.operadora,
      observacoes: data.observacoes,
      tags: data.tags ?? [],
    }))
    if (future.length > 0) await supabase.from('financial_entries').insert(future)
  }

  revalidatePath(`/app/${orgSlug}/financeiro`)
  return { ok: true as const, data: withEffectiveStatus(data as FinancialEntryRow) }
}

export async function updateFinancialEntry(orgSlug: string, id: string, input: Record<string, any>) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'financial')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('financial_entries')
    .update(pick(input))
    .eq('id', id)
    .eq('organization_id', org.id)
    .select()
    .single()

  if (error || !data) return { ok: false as const, error: error?.message || 'Erro ao salvar lançamento' }

  revalidatePath(`/app/${orgSlug}/financeiro`)
  return { ok: true as const, data: withEffectiveStatus(data as FinancialEntryRow) }
}

export async function deleteFinancialEntry(orgSlug: string, id: string) {
  if (isImpersonating()) {
    return { ok: false as const, error: 'Ações destrutivas não são permitidas em modo de impersonação.' }
  }
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'financial')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()

  const { data: entry } = await supabase
    .from('financial_entries')
    .select('anexos')
    .eq('id', id)
    .eq('organization_id', org.id)
    .maybeSingle()

  const { error } = await supabase
    .from('financial_entries')
    .delete()
    .eq('id', id)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message || 'Erro ao excluir lançamento' }

  const anexos = (entry as any)?.anexos as FinancialEntryRow['anexos'] | undefined
  if (anexos?.length) {
    const legacyPaths = anexos.filter(a => a.path).map(a => a.path!)
    if (legacyPaths.length) await supabase.storage.from('financial-attachments').remove(legacyPaths)
    const r2Ids = anexos.filter(a => a.storage_object_id).map(a => a.storage_object_id!)
    await Promise.all(r2Ids.map(id => deleteObject(orgSlug, id)))
  }

  revalidatePath(`/app/${orgSlug}/financeiro`)
  return { ok: true as const }
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

