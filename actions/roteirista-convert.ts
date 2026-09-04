'use server'

/**
 * Convert a Roteirista conversation into a draft quotation.
 * Split out of actions/roteirista.ts.
 */

import { createClient } from '@/lib/supabase/server'
import { checkMemberPermission } from '@/lib/permissions.server'
import { extractQuotationDraft } from '@/lib/ai/roteirista'
import { getGeminiKey, hasGeminiKey } from '@/lib/ai/api-key'
import { consumeAiCredits } from '@/lib/plans/server'
import { revalidatePath } from 'next/cache'
import { requireRoteiristaAccess } from './roteirista'

export async function convertRoteiroToQuotation(orgSlug: string, roteiroId: string): Promise<{ ok: true; quotationId: string } | { ok: false; error: string }> {
  const access = await requireRoteiristaAccess(orgSlug)
  if (!access.ok) return access
  const cotacoesPerm = await checkMemberPermission(access.org.id, access.user.id, 'cotacoes')
  if (!cotacoesPerm.allowed) return { ok: false, error: cotacoesPerm.reason }
  if (!hasGeminiKey()) return { ok: false, error: 'IA (Gemini) não configurada.' }

  const supabase = createClient()
  const { data: roteiro } = await supabase
    .from('roteiro_generations')
    .select('*')
    .eq('organization_id', access.org.id)
    .eq('id', roteiroId)
    .maybeSingle()
  if (!roteiro) return { ok: false, error: 'Roteiro não encontrado.' }

  const { data: msgs } = await supabase
    .from('roteiro_messages')
    .select('role, content')
    .eq('roteiro_id', roteiroId)
    .order('created_at', { ascending: true })

  if (!msgs || msgs.length === 0) return { ok: false, error: 'Conversa vazia — não há o que transformar em cotação.' }

  const accountId = (access.org as any).account_id as string | null
  if (accountId) {
    const credit = await consumeAiCredits({ accountId, action: 'roteirista_generate', metadata: { feature: 'roteirista_convert', orgSlug } })
    if (!credit.success) {
      return {
        ok: false,
        error: credit.error === 'insufficient_credits'
          ? 'Seus créditos de IA acabaram este mês. Faça upgrade ou aguarde a renovação.'
          : 'Não foi possível validar seus créditos de IA. Tente novamente.',
      }
    }
  }

  const conversationText = msgs
    .map(m => `[${m.role === 'user' ? 'Atendente' : 'IA'}]: ${m.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}`)
    .join('\n\n')

  let draft
  try {
    draft = await extractQuotationDraft(getGeminiKey(), conversationText)
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Erro ao extrair os dados da conversa.' }
  }

  const destino = draft.destino || roteiro.destino || roteiro.title
  const { data: quotation, error } = await supabase
    .from('travel_proposals')
    .insert({
      organization_id: access.org.id,
      created_by: access.user.id,
      contato_id: null,
      title: roteiro.title,
      destinations: destino ? [{ name: destino }] : [],
      origin_label: draft.origem || null,
      start_date: draft.data_ida || roteiro.data_ida,
      end_date: draft.data_volta || roteiro.data_volta,
      pax_count: roteiro.pax_adults + roteiro.pax_children,
      itinerary_html: draft.itinerary_html || roteiro.result_html,
      flights_html: draft.flights_html,
      price_per_person_cents: draft.price_per_person_cents,
      total_cents: draft.total_cents,
      is_offer: false,
      offer_published: false,
      status: 'draft',
    })
    .select('id')
    .single()

  if (error || !quotation) return { ok: false, error: error?.message || 'Erro ao criar a cotação.' }

  if (draft.lodgings.length > 0) {
    await supabase.from('quotation_lodgings').insert(
      draft.lodgings.map((l, i) => ({
        quotation_id: quotation.id,
        sort_order: i,
        name: l.name,
        room_category: l.room_category,
        board: l.board,
        description_html: l.description_html,
        option_price_per_person_cents: l.price_per_person_cents,
      })),
    )
  }

  await supabase.from('roteiro_generations').update({ converted_quotation_id: quotation.id }).eq('id', roteiroId)
  revalidatePath(`/app/${orgSlug}/roteirista`)
  return { ok: true, quotationId: quotation.id }
}
