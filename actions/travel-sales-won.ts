'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { isTravelNiche } from '@/lib/niche'
import { inngest } from '@/lib/inngest/client'
import { revalidatePath } from 'next/cache'
import { mapProposalToSaleFields } from '@/lib/travel-sales/map-proposal-fields'


/**
 * Called from moveLeadToStage when a lead enters a "won" stage.
 * If the org is a travel agency and the lead has a linked proposal without a
 * sale yet, auto-create a pre-filled draft travel sale. Never throws.
 *
 * Uses the caller's RLS client (the acting user must be an org member).
 */
export async function maybeCreateTravelSaleOnWon(
  supabase: ReturnType<typeof createClient>,
  org: { id: string; niche?: string | null },
  leadId: string,
  userId: string,
): Promise<void> {
  try {
    if (!isTravelNiche(org.niche)) return

    // Most recent proposal linked to this lead.
    const { data: proposal } = await supabase
      .from('travel_proposals')
      .select('*')
      .eq('organization_id', org.id)
      .eq('contato_id', leadId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!proposal) return

    // Idempotency: skip if a sale already exists for this proposal.
    const { data: existing } = await supabase
      .from('travel_sales')
      .select('id')
      .eq('organization_id', org.id)
      .eq('proposal_id', proposal.id)
      .maybeSingle()
    if (existing) return

    const saleFields = mapProposalToSaleFields(proposal)
    const { data: created } = await supabase.from('travel_sales').insert({
      organization_id: org.id,
      contato_id: leadId,
      proposal_id: proposal.id,
      created_by: userId,
      status: 'open',
      ...saleFields,
    }).select('id').single()

    if (created) {
      // Fires automation triggers `viagens.reserva.created` (sempre) e
      // `viagens.embarque.scheduled` (só quando já vem com data de embarque).
      await inngest.send({ name: 'viagens.reserva.created', data: { orgId: org.id, leadId, saleId: created.id } })
      if ((saleFields as any).departure_date) {
        await inngest.send({ name: 'viagens.embarque.scheduled', data: { orgId: org.id, leadId, saleId: created.id } })
      }
    }
  } catch (err: any) {
    console.error('[maybeCreateTravelSaleOnWon] error:', err?.message)
  }
}

/**
 * Monta as tarefas sugeridas (por produto, ver lib/reservas/task-templates.ts)
 * pra tela de revisão — não grava nada ainda, só sugere.
 */
export async function getSuggestedTasksForSale(orgSlug: string, saleId: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'reservas')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const { listSaleProducts } = await import('@/actions/sale-products')
  const { suggestTasksForProducts } = await import('@/lib/reservas/task-templates')

  const supabase = createClient()
  const { data: sale } = await supabase
    .from('travel_sales')
    .select('client_name')
    .eq('id', saleId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!sale) return { ok: false as const, error: 'Venda não encontrada.' }

  const products = await listSaleProducts(orgSlug, saleId)
  const suggestions = suggestTasksForProducts(products, (sale as any).client_name || 'cliente')
  return { ok: true as const, suggestions }
}

/**
 * Grava as tarefas selecionadas pelo agente na tela de "Tarefas sugeridas".
 * Idempotência via travel_sales.tasks_generated_at, igual ao fluxo antigo.
 */
export async function generateTasksFromSuggestions(
  orgSlug: string, saleId: string,
  selected: { title: string; description: string; due_date: string; priority: string; source_product_id: string }[],
) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'reservas')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  if (selected.length === 0) return { ok: true as const, tasksCreated: 0 }

  const supabase = createClient()
  const { data: sale } = await supabase
    .from('travel_sales')
    .select('contato_id')
    .eq('id', saleId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!sale) return { ok: false as const, error: 'Venda não encontrada.' }

  const { error } = await supabase.from('tasks').insert(
    selected.map(t => ({
      organization_id: org.id,
      contato_id: (sale as any).contato_id,
      sale_id: saleId,
      source_product_id: t.source_product_id,
      title: t.title,
      description: t.description,
      due_date: t.due_date,
      priority: t.priority,
      status: 'open',
      created_by: user.id,
      assigned_to: user.id,
    }))
  )
  if (error) return { ok: false as const, error: error.message }

  await supabase
    .from('travel_sales')
    .update({ tasks_generated_at: new Date().toISOString() })
    .eq('id', saleId)
    .eq('organization_id', org.id)

  revalidatePath(`/app/${orgSlug}/reservas`)
  revalidatePath(`/app/${orgSlug}/tarefas`)
  return { ok: true as const, tasksCreated: selected.length }
}
