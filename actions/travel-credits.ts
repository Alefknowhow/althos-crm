'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'

export type TravelCreditRow = {
  id: string
  organization_id: string
  contato_id: string
  valor_cents: number
  valor_usado_cents: number
  operadora: string
  data_emissao: string
  validade: string | null
  origem_sale_id: string | null
  status: 'available' | 'used' | 'cancelled'
  observacoes: string | null
  created_at: string
  updated_at: string
}

export type TravelCreditUsageRow = {
  id: string
  organization_id: string
  credit_id: string
  sale_id: string | null
  valor_cents: number
  created_by: string | null
  created_at: string
}

/** Todos os créditos do contato, mais recentes primeiro. */
export async function listCreditsForContato(orgSlug: string, contatoId: string): Promise<TravelCreditRow[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('travel_credits')
    .select('*')
    .eq('organization_id', org.id)
    .eq('contato_id', contatoId)
    .order('created_at', { ascending: false })
  return (data as TravelCreditRow[]) ?? []
}

/** Só os créditos com saldo disponível (status='available') — usado no picker de "aplicar crédito". */
export async function listAvailableCreditsForContato(orgSlug: string, contatoId: string): Promise<TravelCreditRow[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('travel_credits')
    .select('*')
    .eq('organization_id', org.id)
    .eq('contato_id', contatoId)
    .eq('status', 'available')
    .order('created_at', { ascending: true })
  return (data as TravelCreditRow[]) ?? []
}

export async function listUsagesForCredit(orgSlug: string, creditId: string): Promise<TravelCreditUsageRow[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('travel_credit_usages')
    .select('*')
    .eq('organization_id', org.id)
    .eq('credit_id', creditId)
    .order('created_at', { ascending: false })
  return (data as TravelCreditUsageRow[]) ?? []
}

/**
 * Cria um crédito de viagem para o contato. Chamada principal é
 * cancelTravelSale (actions/travel-sales.ts) — todo cancelamento de reserva
 * gera um crédito. Loga em contato_activities pro timeline do perfil.
 */
export async function createCredit(
  orgSlug: string,
  input: {
    contatoId: string
    valorCents: number
    operadora: string
    validade?: string | null
    observacoes?: string | null
    origemSaleId?: string | null
  },
) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'sales')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  if (!input.contatoId) return { ok: false as const, error: 'Contato não informado.' }
  if (!input.valorCents || input.valorCents <= 0) return { ok: false as const, error: 'Informe um valor de crédito válido.' }
  if (!input.operadora?.trim()) return { ok: false as const, error: 'Informe a operadora.' }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('travel_credits')
    .insert({
      organization_id: org.id,
      contato_id: input.contatoId,
      valor_cents: Math.round(input.valorCents),
      operadora: input.operadora.trim(),
      validade: input.validade || null,
      observacoes: input.observacoes?.trim() || null,
      origem_sale_id: input.origemSaleId || null,
    })
    .select()
    .single()

  if (error || !data) return { ok: false as const, error: error?.message || 'Erro ao criar crédito' }

  await supabase.from('contato_activities').insert({
    contato_id: input.contatoId,
    organization_id: org.id,
    type: 'credit_created',
    payload: {
      credit_id: data.id,
      valor_cents: data.valor_cents,
      operadora: data.operadora,
    },
    created_by: user.id,
  })

  revalidatePath(`/app/${orgSlug}/contatos/${input.contatoId}`)
  revalidatePath(`/app/${orgSlug}/reservas`)
  return { ok: true as const, data: data as TravelCreditRow }
}

/**
 * Aplica (total ou parcialmente) um crédito disponível numa venda. Valida
 * saldo, registra o uso em travel_credit_usages e atualiza o saldo/status
 * do crédito. Loga em contato_activities.
 */
export async function applyCreditToSale(
  orgSlug: string,
  input: { creditId: string; saleId: string; valorCents: number },
) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'sales')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  if (!input.valorCents || input.valorCents <= 0) {
    return { ok: false as const, error: 'Informe um valor válido para aplicar.' }
  }

  const supabase = createClient()

  const { data: credit } = await supabase
    .from('travel_credits')
    .select('*')
    .eq('organization_id', org.id)
    .eq('id', input.creditId)
    .maybeSingle()

  if (!credit) return { ok: false as const, error: 'Crédito não encontrado.' }
  if (credit.status !== 'available') return { ok: false as const, error: 'Este crédito não está mais disponível.' }

  const saldo = credit.valor_cents - credit.valor_usado_cents
  const valorAplicado = Math.round(input.valorCents)
  if (valorAplicado > saldo) {
    return { ok: false as const, error: `O crédito tem apenas ${(saldo / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} de saldo disponível.` }
  }

  const novoValorUsado = credit.valor_usado_cents + valorAplicado
  const novoStatus = novoValorUsado >= credit.valor_cents ? 'used' : 'available'

  const { error: updateErr } = await supabase
    .from('travel_credits')
    .update({ valor_usado_cents: novoValorUsado, status: novoStatus })
    .eq('id', credit.id)
    .eq('organization_id', org.id)

  if (updateErr) return { ok: false as const, error: updateErr.message || 'Erro ao aplicar crédito' }

  const { error: usageErr } = await supabase.from('travel_credit_usages').insert({
    organization_id: org.id,
    credit_id: credit.id,
    sale_id: input.saleId,
    valor_cents: valorAplicado,
    created_by: user.id,
  })

  if (usageErr) return { ok: false as const, error: usageErr.message || 'Erro ao registrar utilização do crédito' }

  await supabase.from('contato_activities').insert({
    contato_id: credit.contato_id,
    organization_id: org.id,
    type: 'credit_used',
    payload: {
      credit_id: credit.id,
      sale_id: input.saleId,
      valor_cents: valorAplicado,
    },
    created_by: user.id,
  })

  revalidatePath(`/app/${orgSlug}/contatos/${credit.contato_id}`)
  revalidatePath(`/app/${orgSlug}/reservas`)
  return { ok: true as const }
}
