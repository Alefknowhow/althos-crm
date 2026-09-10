'use server'

import { getActionContext } from '@/lib/services/context'
import { createTravelSaleCore } from '@/lib/services/travel-sales-create'

/**
 * Manual travel-sale creation (mapProposalToSaleFields is shared with
 * the auto-creation-on-won path). Split out of actions/travel-sales.ts.
 */

import type { ExtractedTravelDocument } from '@/lib/ai/document-extract'

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
  return createTravelSaleCore(await getActionContext(orgSlug), proposalId, contatoId, voucherOptions)
}
