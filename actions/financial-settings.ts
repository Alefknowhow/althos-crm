'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization, isImpersonating } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'

import { FINANCIAL_SETTING_TYPES, type FinancialSettingType } from '@/lib/financial-settings-types'

export type { FinancialSettingType }

export type FinancialSettingRow = {
  id: string
  organization_id: string
  type: FinancialSettingType
  name: string
  /** Só usado pra type='operadora' — dia do mês (1-31) em que a operadora paga a comissão. */
  payment_day: number | null
  created_at: string
}

export async function listFinancialSettings(orgSlug: string): Promise<Record<FinancialSettingType, FinancialSettingRow[]>> {
  const org = await getCurrentOrganization(orgSlug)
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

/** Dia do mês (1-31) em que a operadora paga a comissão — só faz sentido pra type='operadora'. */
export async function updateFinancialSettingPaymentDay(orgSlug: string, id: string, paymentDay: number | null) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'financial')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  if (paymentDay != null && (paymentDay < 1 || paymentDay > 31)) {
    return { ok: false as const, error: 'Informe um dia entre 1 e 31.' }
  }

  const supabase = createClient()
  const { error } = await supabase
    .from('financial_settings')
    .update({ payment_day: paymentDay })
    .eq('id', id)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message || 'Erro ao salvar o dia de pagamento.' }

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
