'use server'

/**
 * Manual travel-sale creation (mapProposalToSaleFields is shared with
 * the auto-creation-on-won path). Split out of actions/travel-sales.ts.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'
import type { ExtractedTravelDocument } from '@/lib/ai/document-extract'
import { extractedToSaleFieldsPatch, extractedTravelers } from '@/lib/travel-sales/apply-extraction'
import type { TravelSaleRow } from './travel-sales-shared'
import { listSaleOperatorOptions } from './travel-sales-crud'


// ── helpers ─────────────────────────────────────────────────────────────────

/**
 * Map a proposal row into the pre-fillable fields of a travel sale.
 * Shared by the auto-creation-on-won path and the manual "Nova venda" flow.
 */
export function mapProposalToSaleFields(proposal: any): Record<string, any> {
  const destination = (proposal.destinations || [])
    .map((d: any) => d?.name).filter(Boolean).join(', ') || null
  const hotelName = (proposal.hotels || [])
    .map((h: any) => h?.name).filter(Boolean).join(', ') || null
  const airlines = Array.from(new Set((proposal.flights || [])
    .map((f: any) => f?.airline).filter(Boolean)))
  const airline = airlines.length ? airlines.join(', ') : null
  const services = Object.entries(proposal.services || {})
    .filter(([, v]: any) => v?.enabled)
    .map(([k]) => k)
  const methods: string[] = proposal.payment?.methods || []

  let negotiationDays: number | null = null
  if (proposal.created_at) {
    const ms = Date.now() - new Date(proposal.created_at).getTime()
    negotiationDays = Math.max(0, Math.round(ms / 86400000))
  }

  return {
    client_name: proposal.client_name,
    destination,
    departure_date: proposal.start_date,
    return_date: proposal.end_date,
    negotiation_days: negotiationDays,
    total_cents: proposal.total_cents || 0,
    hotel_name: hotelName,
    airline,
    services,
    payment_method: methods.join(', ') || null,
    travelers: Array.isArray(proposal.travelers) ? proposal.travelers : [],
    travelers_note: proposal.travelers_note ?? null,
  }
}

/**
 * Manually create a travel sale, optionally pre-filled from a proposal.
 * Powers the "Nova venda" button — a robust fallback to the auto-creation
 * that fires when a lead is moved to a won stage.
 *
 * `contatoId` is mandatory: toda venda precisa estar ligada a um lead/contato
 * do CRM, para que o vendedor não consiga registrar um cliente que não foi
 * cadastrado. O nome do cliente da venda vem sempre do contato vinculado.
 */
export async function createTravelSale(
  orgSlug: string,
  proposalId: string | null | undefined,
  contatoId: string,
  voucherOptions?: { extracted?: ExtractedTravelDocument | null; voucher?: { url: string; name: string } | null },
) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'reservas')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  if (!contatoId) {
    return { ok: false as const, error: 'Selecione o cliente (contato do CRM) para criar a venda.' }
  }

  const supabase = createClient()

  const { data: contato } = await supabase
    .from('contatos')
    .select('id, name')
    .eq('organization_id', org.id)
    .eq('id', contatoId)
    .maybeSingle()
  if (!contato) return { ok: false as const, error: 'Contato não encontrado.' }

  let prefill: Record<string, any> = {}
  let linkedProposalId: string | null = null

  if (proposalId) {
    const { data: proposal } = await supabase
      .from('travel_proposals')
      .select('*')
      .eq('organization_id', org.id)
      .eq('id', proposalId)
      .maybeSingle()
    if (!proposal) return { ok: false as const, error: 'Proposta não encontrada.' }
    prefill = mapProposalToSaleFields(proposal)
    linkedProposalId = (proposal as any).id
  }

  // Prefill vindo de um voucher lido por IA no próprio "Nova venda" — mesma
  // ideia da proposta acima, só que a partir do documento em vez de uma
  // proposta salva. Sem proposta vinculada (esse fluxo não gera uma).
  const extracted = voucherOptions?.extracted
  if (extracted) {
    const operatorOptions = await listSaleOperatorOptions(orgSlug)
    const patch = extractedToSaleFieldsPatch(extracted, { operatorOptions })
    const travelers = extractedTravelers(extracted)
    prefill = { ...prefill, ...patch, ...(travelers.length > 0 ? { travelers } : {}) }
  }
  if (voucherOptions?.voucher) {
    prefill.vouchers = [voucherOptions.voucher]
  }

  const { data, error } = await supabase
    .from('travel_sales')
    .insert({
      organization_id: org.id,
      contato_id: contato.id,
      proposal_id: linkedProposalId,
      created_by: user.id,
      status: 'open',
      ...prefill,
      client_name: (contato as any).name || prefill.client_name || null,
    })
    .select()
    .single()

  if (error || !data) return { ok: false as const, error: error?.message || 'Erro ao criar venda' }

  if (extracted) {
    const { bulkCreateSaleProductsFromExtraction } = await import('@/actions/sale-products')
    await bulkCreateSaleProductsFromExtraction(orgSlug, (data as TravelSaleRow).id, extracted)
  }

  // In-app notification (org-wide) so the team sees the new sale in the bell.
  const { createNotification } = await import('@/actions/notifications')
  const clientName = (data as TravelSaleRow).client_name
  await createNotification({
    organizationId: org.id,
    type: 'new_sale',
    title: 'Nova venda viagem criada',
    content: clientName ? `Venda iniciada para ${clientName}.` : 'Uma nova venda viagem foi iniciada.',
    link: `/app/${orgSlug}/reservas`,
  })

  revalidatePath(`/app/${orgSlug}/reservas`)
  return { ok: true as const, data: data as TravelSaleRow }
}
