'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { inngest } from '@/lib/inngest/client'
import { revalidatePath } from 'next/cache'

/**
 * Apólices (Vertical Seguros, Fase 3) — ver
 * supabase/migrations/0187_insurance_policies.sql. Espelha
 * actions/property-deals.ts::closeDeal (Imóveis): emite a partir de uma
 * cotação aprovada (ou direto), sincroniza comissão pro Financeiro,
 * emite evento Inngest. Diferença deliberada: usa o parcelamento real
 * de financial_entries (installment_group_id/parcela_numero/
 * parcela_total, migration 0120) — primeira vertical a de fato
 * consumir essas colunas, já que o prompt pede parcelamento.
 */

export type InsurancePolicyStatus = 'em_emissao' | 'ativa' | 'suspensa' | 'cancelada' | 'expirada'

export type InsurancePolicyRow = {
  id: string
  policy_number: string | null
  quote_id: string | null
  contato_id: string
  insurance_product_id: string
  insurer_id: string
  broker_user_id: string | null
  premium_cents: number
  start_date: string | null
  end_date: string | null
  payment_method: string | null
  installments_count: number
  commission_cents: number | null
  status: InsurancePolicyStatus
  notes: string | null
  created_at: string
  contato_name: string | null
  product_name: string | null
  insurer_name: string | null
}

const IssueSchema = z.object({
  quoteId: z.string().uuid().nullable().optional(),
  contatoId: z.string().uuid(),
  insuranceProductId: z.string().uuid(),
  insurerId: z.string().uuid(),
  brokerUserId: z.string().uuid().nullable().optional(),
  premiumCents: z.number().int().min(1),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  paymentMethod: z.string().max(80).nullable().optional(),
  installmentsCount: z.number().int().min(1).max(48).optional(),
  commissionCents: z.number().int().min(0).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

async function requireAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'seguros')
  if (!check.allowed) throw new Error(check.reason || 'Sem permissão')
  return { org, user }
}

function mapRow(r: any): InsurancePolicyRow {
  return {
    id: r.id, policy_number: r.policy_number, quote_id: r.quote_id, contato_id: r.contato_id,
    insurance_product_id: r.insurance_product_id, insurer_id: r.insurer_id, broker_user_id: r.broker_user_id,
    premium_cents: r.premium_cents, start_date: r.start_date, end_date: r.end_date,
    payment_method: r.payment_method, installments_count: r.installments_count,
    commission_cents: r.commission_cents, status: r.status, notes: r.notes, created_at: r.created_at,
    contato_name: r.contatos?.name ?? null, product_name: r.insurance_products?.name ?? null,
    insurer_name: r.insurers?.name ?? null,
  }
}

const SELECT = '*, contatos(name), insurance_products(name), insurers(name)'

export async function listPolicies(orgSlug: string): Promise<InsurancePolicyRow[]> {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('insurance_policies').select(SELECT)
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })
    .limit(500)
  return (data || []).map(mapRow)
}

export async function getPolicy(orgSlug: string, id: string): Promise<InsurancePolicyRow | null> {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('insurance_policies').select(SELECT)
    .eq('id', id).eq('organization_id', org.id)
    .maybeSingle()
  return data ? mapRow(data) : null
}

export async function issuePolicy(orgSlug: string, input: unknown) {
  const { org, user } = await requireAccess(orgSlug)
  const parsed = IssueSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'Dados inválidos: ' + parsed.error.issues[0]?.message }
  const v = parsed.data
  const installments = v.installmentsCount ?? 1

  const supabase = createClient()

  const { data: policy, error } = await supabase
    .from('insurance_policies')
    .insert({
      organization_id: org.id, quote_id: v.quoteId ?? null, contato_id: v.contatoId,
      insurance_product_id: v.insuranceProductId, insurer_id: v.insurerId, broker_user_id: v.brokerUserId ?? null,
      premium_cents: v.premiumCents, start_date: v.startDate || null, end_date: v.endDate || null,
      payment_method: v.paymentMethod ?? null, installments_count: installments,
      commission_cents: v.commissionCents ?? null, notes: v.notes ?? null, created_by: user.id,
    })
    .select('id')
    .single()
  if (error || !policy) return { ok: false as const, error: error?.message || 'Erro ao emitir apólice' }

  if (v.quoteId) {
    await supabase.from('insurance_quotes').update({ status: 'aprovada' }).eq('id', v.quoteId).eq('organization_id', org.id)
  }

  // Comissão → Financeiro, parcelada quando installments > 1 — primeiro
  // consumidor real de installment_group_id/parcela_numero/parcela_total
  // (migration 0120), até aqui só colunas existentes sem uso.
  if (v.commissionCents && v.commissionCents > 0) {
    const groupId = installments > 1 ? crypto.randomUUID() : null
    const base = Math.floor(v.commissionCents / installments)
    const remainder = v.commissionCents - base * installments
    const startBase = v.startDate ? new Date(v.startDate) : new Date()

    const rows = Array.from({ length: installments }, (_, i) => {
      const due = new Date(startBase)
      due.setMonth(due.getMonth() + i)
      return {
        organization_id: org.id, tipo: 'receita', categoria: 'Comissão de seguros',
        valor_cents: base + (i === installments - 1 ? remainder : 0),
        status: 'pendente', contato_id: v.contatoId, insurance_policy_id: policy.id,
        vencimento: due.toISOString().slice(0, 10),
        installment_group_id: groupId, parcela_numero: installments > 1 ? i + 1 : null,
        parcela_total: installments > 1 ? installments : null, created_by: user.id,
      }
    })
    await supabase.from('financial_entries').insert(rows)
  }

  await inngest.send({
    name: 'seguros.policy.issued',
    data: { orgId: org.id, leadId: v.contatoId, policyId: policy.id, insurerId: v.insurerId },
  })

  revalidatePath(`/app/${orgSlug}/apolices`)
  revalidatePath(`/app/${orgSlug}/cotacoes-seguro`)
  revalidatePath(`/app/${orgSlug}/financeiro`)
  return { ok: true as const, id: policy.id as string }
}

export async function cancelPolicy(orgSlug: string, id: string) {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()

  const { data: policy, error } = await supabase
    .from('insurance_policies')
    .update({ status: 'cancelada' })
    .eq('id', id).eq('organization_id', org.id)
    .select('id')
    .maybeSingle()
  if (error || !policy) return { ok: false as const, error: error?.message || 'Apólice não encontrada' }

  await supabase
    .from('financial_entries')
    .update({ status: 'cancelado' })
    .eq('insurance_policy_id', id).eq('organization_id', org.id)
    .in('status', ['pendente', 'vencido'])

  revalidatePath(`/app/${orgSlug}/apolices`)
  revalidatePath(`/app/${orgSlug}/financeiro`)
  return { ok: true as const }
}
