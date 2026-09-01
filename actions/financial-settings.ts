'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization, isImpersonating } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'

import { FINANCIAL_SETTING_TYPES, type FinancialSettingType } from '@/lib/financial-settings-types'

export type { FinancialSettingType }

export type PaymentScheduleType = 'dia_fixo' | 'decendio' | 'semanal'

export type FinancialSettingRow = {
  id: string
  organization_id: string
  type: FinancialSettingType
  name: string
  /** Só usado pra type='operadora'. */
  payment_schedule_type: PaymentScheduleType
  /** Modo 'dia_fixo' — dia do mês (1-31) em que a operadora paga a comissão. */
  payment_day: number | null
  /** Modo 'decendio' — dias após o fechamento do decêndio (1-10/11-20/21-fim) em que a operadora paga. */
  payment_offset_days: number | null
  /** Só usado pra type='forma_pagamento' — taxa cobrada pelo meio de pagamento (%), ex.: 3.45 = 3,45%. */
  payment_fee_percent: number | null
  created_at: string
}

export async function listFinancialSettings(orgSlug: string): Promise<Record<FinancialSettingType, FinancialSettingRow[]>> {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'financial')
  if (!perm.allowed) {
    return FINANCIAL_SETTING_TYPES.reduce((acc, t) => { acc[t.type] = []; return acc }, {} as Record<FinancialSettingType, FinancialSettingRow[]>)
  }
  const supabase = createClient()
  const { data } = await supabase
    .from('financial_settings')
    .select('*')
    .eq('organization_id', org.id)
    .order('name', { ascending: true })

  const out = Object.fromEntries(FINANCIAL_SETTING_TYPES.map(t => [t.type, [] as FinancialSettingRow[]])) as Record<FinancialSettingType, FinancialSettingRow[]>
  for (const row of (data as FinancialSettingRow[]) ?? []) out[row.type].push(row)
  return out
}

export async function createFinancialSetting(orgSlug: string, type: FinancialSettingType, name: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'financial')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const trimmed = name.trim()
  if (!trimmed) return { ok: false as const, error: 'Informe um nome.' }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('financial_settings')
    .insert({ organization_id: org.id, type, name: trimmed })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return { ok: false as const, error: 'Já existe um item com esse nome.' }
    return { ok: false as const, error: error.message || 'Erro ao criar item.' }
  }

  revalidatePath(`/app/${orgSlug}/financeiro`)
  return { ok: true as const, data: data as FinancialSettingRow }
}

/**
 * Configura como a operadora paga a comissão — só faz sentido pra
 * type='operadora'. 'dia_fixo' usa paymentDay (dia do mês, 1-31);
 * 'decendio' usa offsetDays (dias após o fechamento do bloco de 10 dias em
 * que a venda caiu); 'semanal' não usa nenhum dos dois — corte a cada 8
 * dias com vencimento fixo em 7 dias após o corte (ver
 * lib/financial/operator-payment.ts:nextSemanalPaymentDate).
 */
export async function updateFinancialSettingPaymentSchedule(
  orgSlug: string,
  id: string,
  input: { scheduleType: PaymentScheduleType; paymentDay: number | null; offsetDays: number | null },
) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'financial')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  if (input.scheduleType === 'dia_fixo' && input.paymentDay != null && (input.paymentDay < 1 || input.paymentDay > 31)) {
    return { ok: false as const, error: 'Informe um dia entre 1 e 31.' }
  }
  if (input.scheduleType === 'decendio' && input.offsetDays != null && (input.offsetDays < 0 || input.offsetDays > 60)) {
    return { ok: false as const, error: 'Informe um número de dias entre 0 e 60.' }
  }

  const supabase = createClient()
  const { error } = await supabase
    .from('financial_settings')
    .update({
      payment_schedule_type: input.scheduleType,
      payment_day: input.scheduleType === 'dia_fixo' ? input.paymentDay : null,
      payment_offset_days: input.scheduleType === 'decendio' ? input.offsetDays : null,
    })
    .eq('id', id)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message || 'Erro ao salvar o pagamento.' }

  revalidatePath(`/app/${orgSlug}/financeiro`)
  return { ok: true as const }
}

/** Taxa cobrada pelo meio de pagamento (Configurações > Formas de pagamento)
 *  — ex.: cartão de crédito, boleto. Guardada como percentual (0-100). */
export async function updateFinancialSettingFee(orgSlug: string, id: string, feePercent: number | null) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'financial')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  if (feePercent != null && (feePercent < 0 || feePercent > 100)) {
    return { ok: false as const, error: 'Informe uma taxa entre 0 e 100%.' }
  }

  const supabase = createClient()
  const { error } = await supabase
    .from('financial_settings')
    .update({ payment_fee_percent: feePercent })
    .eq('id', id)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message || 'Erro ao salvar a taxa.' }

  revalidatePath(`/app/${orgSlug}/financeiro`)
  return { ok: true as const }
}

export async function deleteFinancialSetting(orgSlug: string, id: string) {
  if (isImpersonating()) {
    return { ok: false as const, error: 'Ações destrutivas não são permitidas em modo de impersonação.' }
  }
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'financial')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  const { error } = await supabase
    .from('financial_settings')
    .delete()
    .eq('id', id)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message || 'Erro ao excluir item.' }

  revalidatePath(`/app/${orgSlug}/financeiro`)
  return { ok: true as const }
}
