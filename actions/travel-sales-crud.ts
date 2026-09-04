'use server'

/**
 * Travel sale CRUD: list/get/update/delete/cancel. Split out of
 * actions/travel-sales.ts.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization, isImpersonating } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'
import { pick, type TravelSaleRow } from './travel-sales-shared'

export async function listSaleOperatorOptions(orgSlug: string): Promise<string[]> {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'reservas')
  if (!perm.allowed) return []
  const supabase = createClient()
  const { data } = await supabase
    .from('financial_settings')
    .select('name')
    .eq('organization_id', org.id)
    .eq('type', 'operadora')
    .order('name', { ascending: true })
  return (data ?? []).map((r: any) => r.name as string)
}

export async function listTravelSales(orgSlug: string): Promise<TravelSaleRow[]> {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'reservas')
  if (!perm.allowed) return []
  const supabase = createClient()
  const { data } = await supabase
    .from('travel_sales')
    .select('*')
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })
    .limit(500)
  return (data as TravelSaleRow[]) ?? []
}

export async function getTravelSale(orgSlug: string, id: string): Promise<TravelSaleRow | null> {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'reservas')
  if (!perm.allowed) return null
  const supabase = createClient()
  const { data } = await supabase
    .from('travel_sales')
    .select('*')
    .eq('organization_id', org.id)
    .eq('id', id)
    .maybeSingle()
  return (data as TravelSaleRow) ?? null
}

export async function updateTravelSale(orgSlug: string, id: string, input: Record<string, any>) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'reservas')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('travel_sales')
    .update(pick(input))
    .eq('id', id)
    .eq('organization_id', org.id)
    .select()
    .single()

  if (error) return { ok: false as const, error: error.message || 'Erro ao salvar venda' }
  const s = data as TravelSaleRow

  // Mesmo sync de saveTravelSaleAndGenerateTasks — precisa acontecer em
  // QUALQUER salvamento (não só ao gerar tarefas), senão editar comissão/
  // retenção pelo botão "Salvar" simples nunca refletia no Financeiro.
  const { syncSaleRevenueEntry } = await import('@/actions/financial')
  await syncSaleRevenueEntry(orgSlug, {
    id: s.id, contato_id: s.contato_id, client_name: s.client_name,
    operator: s.operator, commission_cents: s.commission_cents ?? null,
    retained_commission_cents: s.retained_commission_cents ?? null,
    created_at: s.created_at,
  })

  revalidatePath(`/app/${orgSlug}/reservas`)
  return { ok: true as const, data: s }
}

export async function deleteTravelSale(orgSlug: string, id: string) {
  if (isImpersonating()) {
    return { ok: false as const, error: 'Ações destrutivas não são permitidas em modo de impersonação.' }
  }
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'reservas')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  const { error } = await supabase
    .from('travel_sales')
    .delete()
    .eq('id', id)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message || 'Erro ao excluir venda' }
  revalidatePath(`/app/${orgSlug}/reservas`)
  return { ok: true as const }
}

/**
 * Cancela a reserva e gera o crédito de viagem correspondente na mesma
 * operação — cancelamento sem crédito não é uma opção neste fluxo, pois a
 * operadora sempre retém o valor como crédito futuro (não devolve em
 * dinheiro). Os 4 campos são obrigatórios.
 */
export async function cancelTravelSale(
  orgSlug: string,
  saleId: string,
  input: { valorCredito: number; operadora: string; validade?: string | null; observacoes?: string | null },
) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'reservas')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  if (!input.valorCredito || input.valorCredito <= 0) {
    return { ok: false as const, error: 'Informe o valor do crédito gerado pela operadora.' }
  }
  if (!input.operadora?.trim()) {
    return { ok: false as const, error: 'Informe a operadora responsável pelo crédito.' }
  }

  const supabase = createClient()
  const { data: sale } = await supabase
    .from('travel_sales')
    .select('*')
    .eq('organization_id', org.id)
    .eq('id', saleId)
    .maybeSingle()

  if (!sale) return { ok: false as const, error: 'Venda não encontrada.' }
  if (!(sale as TravelSaleRow).contato_id) {
    return { ok: false as const, error: 'Esta venda não está vinculada a um contato — não é possível gerar o crédito.' }
  }

  const { data: updated, error } = await supabase
    .from('travel_sales')
    .update({ status: 'cancelled' })
    .eq('id', saleId)
    .eq('organization_id', org.id)
    .select()
    .single()

  if (error || !updated) return { ok: false as const, error: error?.message || 'Erro ao cancelar venda' }

  const { createCredit } = await import('@/actions/travel-credits')
  const creditResult = await createCredit(orgSlug, {
    contatoId: (sale as TravelSaleRow).contato_id as string,
    valorCents: Math.round(input.valorCredito),
    operadora: input.operadora,
    validade: input.validade,
    observacoes: input.observacoes,
    origemSaleId: saleId,
  })

  if (!creditResult.ok) {
    return { ok: false as const, error: `Venda cancelada, mas falhou ao gerar o crédito: ${creditResult.error}` }
  }

  revalidatePath(`/app/${orgSlug}/reservas`)
  return { ok: true as const, data: updated as TravelSaleRow, credit: creditResult.data }
}
