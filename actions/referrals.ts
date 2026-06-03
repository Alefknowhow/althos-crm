'use server'

/**
 * Referrals + coupons — per ACCOUNT.
 *
 * Reads are RLS-scoped (members see only their account's rows). Mutations go
 * through SECURITY DEFINER RPCs (redeem_coupon / redeem_referral) since the
 * underlying tables are SELECT-only under RLS. See migration 0059.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'

export interface ReferralOverview {
  accountId: string | null
  referralCode: string | null
  totalReferred: number
  convertedCount: number
  referred: Array<{
    id: string
    name: string | null
    status: string
    createdAt: string | null
    convertedAt: string | null
  }>
}

export interface AppliedCoupon {
  code: string
  description: string | null
  discountType: string
  discountValue: number
  durationMonths: number | null
  appliedAt: string | null
}

/** Friendly PT-BR messages for the RPC error codes. */
const ERROR_MESSAGES: Record<string, string> = {
  forbidden: 'Você não tem permissão para esta conta.',
  not_found: 'Cupom não encontrado.',
  inactive: 'Este cupom não está mais ativo.',
  expired: 'Este cupom expirou.',
  exhausted: 'Este cupom atingiu o limite de usos.',
  already_used: 'Você já resgatou este cupom.',
  invalid_code: 'Código de indicação inválido.',
  self_referral: 'Você não pode usar seu próprio código de indicação.',
  already_referred: 'Esta conta já foi indicada anteriormente.',
}

function messageFor(code: string | undefined): string {
  return (code && ERROR_MESSAGES[code]) || 'Não foi possível concluir. Tente novamente.'
}

export async function getReferralOverview(orgSlug: string): Promise<ReferralOverview> {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const accountId = (org as any).account_id as string | null
  const supabase = createClient()

  if (!accountId) {
    return { accountId: null, referralCode: null, totalReferred: 0, convertedCount: 0, referred: [] }
  }

  const [{ data: account }, { data: rows }] = await Promise.all([
    supabase.from('accounts').select('referral_code').eq('id', accountId).maybeSingle(),
    supabase
      .from('referrals')
      .select('id, status, created_at, converted_at, referred_account_id, referred:referred_account_id(name)')
      .eq('referrer_account_id', accountId)
      .order('created_at', { ascending: false }),
  ])

  const referred = (rows || []).map(r => {
    const ref = (r as any).referred
    const name = Array.isArray(ref) ? ref[0]?.name : ref?.name
    return {
      id: r.id as string,
      name: (name as string | null) ?? null,
      status: (r as any).status as string,
      createdAt: (r as any).created_at as string | null,
      convertedAt: (r as any).converted_at as string | null,
    }
  })

  return {
    accountId,
    referralCode: (account?.referral_code as string | null) ?? null,
    totalReferred: referred.length,
    convertedCount: referred.filter(r => r.status === 'converted' || r.convertedAt).length,
    referred,
  }
}

export async function getAppliedCoupons(orgSlug: string): Promise<AppliedCoupon[]> {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const accountId = (org as any).account_id as string | null
  if (!accountId) return []
  const supabase = createClient()

  const { data } = await supabase
    .from('coupon_uses')
    .select('applied_at, coupons(code, description, discount_type, discount_value, duration_months)')
    .eq('account_id', accountId)
    .order('applied_at', { ascending: false })

  return (data || []).map(row => {
    const c = (row as any).coupons
    const coupon = Array.isArray(c) ? c[0] : c
    return {
      code: coupon?.code ?? '—',
      description: coupon?.description ?? null,
      discountType: coupon?.discount_type ?? 'percent',
      discountValue: coupon?.discount_value ?? 0,
      durationMonths: coupon?.duration_months ?? null,
      appliedAt: (row as any).applied_at ?? null,
    }
  })
}

export async function redeemCoupon(orgSlug: string, code: string) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const accountId = (org as any).account_id as string | null
  if (!accountId) return { ok: false as const, error: 'Conta não encontrada.' }
  if (!code?.trim()) return { ok: false as const, error: 'Informe um código.' }

  const supabase = createClient()
  const { data, error } = await supabase.rpc('redeem_coupon', {
    p_account_id: accountId,
    p_code: code.trim(),
  })

  if (error) return { ok: false as const, error: 'Erro ao validar o cupom.' }
  const result = data as any
  if (!result?.success) return { ok: false as const, error: messageFor(result?.error) }

  revalidatePath(`/app/${orgSlug}/configuracoes/assinatura`)
  return {
    ok: true as const,
    code: result.code as string,
    discountType: result.discount_type as string,
    discountValue: result.discount_value as number,
    durationMonths: result.duration_months as number | null,
  }
}

export async function redeemReferral(orgSlug: string, code: string) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const accountId = (org as any).account_id as string | null
  if (!accountId) return { ok: false as const, error: 'Conta não encontrada.' }
  if (!code?.trim()) return { ok: false as const, error: 'Informe um código.' }

  const supabase = createClient()
  const { data, error } = await supabase.rpc('redeem_referral', {
    p_referred_account_id: accountId,
    p_code: code.trim(),
  })

  if (error) return { ok: false as const, error: 'Erro ao validar o código.' }
  const result = data as any
  if (!result?.success) return { ok: false as const, error: messageFor(result?.error) }

  revalidatePath(`/app/${orgSlug}/configuracoes/assinatura`)
  return { ok: true as const }
}
