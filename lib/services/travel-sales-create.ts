// Internal services: callers must supply an authenticated, organization-scoped context.
import { listSaleOperatorOptions } from '@/actions/travel-sales-crud'
import type { TravelSaleRow } from '@/actions/travel-sales-shared'
import type { ExtractedTravelDocument } from '@/lib/ai/document-extract'
import { inngest } from '@/lib/inngest/client'
import { extractedToSaleFieldsPatch,extractedTravelers } from '@/lib/travel-sales/apply-extraction'
import { mapProposalToSaleFields } from '@/lib/travel-sales/map-proposal-fields'
import { revalidatePath } from 'next/cache'
import type { ActionContext } from './context'

export async function createTravelSaleCore(ctx: ActionContext, proposalId: string | null | undefined, contatoId: string, voucherOptions?: { extracted?: ExtractedTravelDocument | null; voucher?: { url: string; name: string } | null }) {
  const orgSlug = ctx.org.slug
  const user = ctx.user
  const org = ctx.org
  const perm = await ctx.checkPermission(['reservas'])
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  if (!contatoId) {
    return { ok: false as const, error: 'Selecione o cliente (contato do CRM) para criar a venda.' }
  }

  const supabase = ctx.supabase

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

  // Fires automation trigger `viagens.reserva.created`. `viagens.embarque.scheduled`
  // não dispara aqui — é ligado à data de embarque em si (ver
  // lib/inngest/automation-crons.ts::automationEmbarqueScheduledFn), não ao
  // momento em que a reserva foi criada.
  await inngest.send({ name: 'viagens.reserva.created', data: { orgId: org.id, leadId: contato.id, saleId: (data as TravelSaleRow).id } })

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
