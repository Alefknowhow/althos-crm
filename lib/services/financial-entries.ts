// Internal services: callers must supply an authenticated, organization-scoped context.
import { withEffectiveStatus,type FinancialEntryRow } from '@/actions/financial-shared'
import { deleteObject } from '@/actions/storage'
import {
addMonthsIso,
computeInstallmentDates,
computeRecurrenceDates,
} from '@/lib/financial/recurrence'
import { revalidatePath } from 'next/cache'
import type { ActionContext } from './context'
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
export async function createFinancialEntryCore(ctx: ActionContext, input: Record<string, any>) {
  const orgSlug = ctx.org.slug
  const user = ctx.user
  const org = ctx.org
  const perm = await ctx.checkPermission(['financial'])
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  if (input.tipo !== 'receita' && input.tipo !== 'despesa') {
    return { ok: false as const, error: 'Informe o tipo (receita ou despesa).' }
  }
  if (!input.categoria?.trim()) return { ok: false as const, error: 'Informe a categoria.' }
  if (!input.valor_cents || Number(input.valor_cents) <= 0) {
    return { ok: false as const, error: 'Informe um valor válido.' }
  }

  const supabase = ctx.supabase
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

export async function updateFinancialEntryCore(ctx: ActionContext, id: string, input: Record<string, any>) {
  const orgSlug = ctx.org.slug

  const org = ctx.org
  const perm = await ctx.checkPermission(['financial'])
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = ctx.supabase
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

export async function deleteFinancialEntryCore(ctx: ActionContext, id: string) {
  const orgSlug = ctx.org.slug
  if (ctx.impersonating) {
    return { ok: false as const, error: 'Ações destrutivas não são permitidas em modo de impersonação.' }
  }

  const org = ctx.org
  const perm = await ctx.checkPermission(['financial'])
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = ctx.supabase

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
