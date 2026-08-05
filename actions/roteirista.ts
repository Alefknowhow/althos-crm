'use server'

import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import { checkMemberPermission } from '@/lib/permissions.server'
import { isTravelNiche } from '@/lib/niche'
import { sendRoteiroChatMessage, buildQuickStartMessage, extractQuotationDraft, TRAVEL_PLANNER_ENABLED, type RoteiroMode, type RoteiroQuickStartInput, type RoteiroChatTurn } from '@/lib/ai/roteirista'
import { getGeminiKey, hasGeminiKey } from '@/lib/ai/api-key'
import { consumeAiCredits } from '@/lib/plans/server'
import { revalidatePath } from 'next/cache'

export type RoteiroGeneration = {
  id: string
  title: string
  mode: RoteiroMode | null
  destino: string | null
  data_ida: string | null
  data_volta: string | null
  pax_adults: number
  pax_children: number
  result_html: string | null
  status: 'generating' | 'done' | 'error'
  error_message: string | null
  converted_quotation_id: string | null
  created_at: string
}

export type RoteiroMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

async function requireRoteiristaAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  if (!TRAVEL_PLANNER_ENABLED) {
    return { ok: false as const, error: 'Travel Planner está temporariamente desativado.' }
  }
  if (!isTravelNiche(org.niche)) {
    return { ok: false as const, error: 'Módulo disponível apenas para o nicho de viagens.' }
  }
  const perm = await checkMemberPermission(org.id, user.id, 'roteirista')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  return { ok: true as const, user, org }
}

export async function listRoteiros(orgSlug: string): Promise<RoteiroGeneration[]> {
  const access = await requireRoteiristaAccess(orgSlug)
  if (!access.ok) return []
  const supabase = createClient()
  const { data } = await supabase
    .from('roteiro_generations')
    .select('*')
    .eq('organization_id', access.org.id)
    .order('created_at', { ascending: false })
    .limit(100)
  return (data || []) as RoteiroGeneration[]
}

export async function getRoteiro(orgSlug: string, id: string): Promise<RoteiroGeneration | null> {
  const access = await requireRoteiristaAccess(orgSlug)
  if (!access.ok) return null
  const supabase = createClient()
  const { data } = await supabase
    .from('roteiro_generations')
    .select('*')
    .eq('organization_id', access.org.id)
    .eq('id', id)
    .maybeSingle()
  return (data as RoteiroGeneration) || null
}

export async function deleteRoteiro(orgSlug: string, id: string) {
  const access = await requireRoteiristaAccess(orgSlug)
  if (!access.ok) return access
  const supabase = createClient()
  const { error } = await supabase
    .from('roteiro_generations')
    .delete()
    .eq('organization_id', access.org.id)
    .eq('id', id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/roteirista`)
  return { ok: true as const }
}

export async function listRoteiroMessages(orgSlug: string, roteiroId: string): Promise<RoteiroMessage[]> {
  const access = await requireRoteiristaAccess(orgSlug)
  if (!access.ok) return []
  const supabase = createClient()
  const { data } = await supabase
    .from('roteiro_messages')
    .select('id, role, content, created_at')
    .eq('organization_id', access.org.id)
    .eq('roteiro_id', roteiroId)
    .order('created_at', { ascending: true })
  return (data || []) as RoteiroMessage[]
}

async function loadKnowledgeContext(supabase: ReturnType<typeof createClient>, orgId: string): Promise<string> {
  const { data: knowledgeRows } = await supabase
    .from('roteirista_knowledge_items')
    .select('content')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(200)
  return (knowledgeRows || []).map(r => `- ${r.content}`).join('\n')
}

/**
 * Inicia uma conversa nova. `quickStart` é opcional — quando presente, monta
 * a primeira mensagem a partir do formulário-atalho; quando ausente, usa
 * `firstMessage` (texto livre) ou apenas cria a conversa vazia (sem 1ª
 * mensagem) pra o usuário digitar depois.
 */
export async function startRoteiro(
  orgSlug: string,
  input: { quickStart?: RoteiroQuickStartInput; firstMessage?: string },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const access = await requireRoteiristaAccess(orgSlug)
  if (!access.ok) return access
  const { user, org } = access
  if (!hasGeminiKey()) return { ok: false, error: 'IA (Gemini) não configurada.' }

  const supabase = createClient()
  const firstMessage = input.quickStart ? buildQuickStartMessage(input.quickStart) : (input.firstMessage?.trim() || null)

  const title = input.quickStart
    ? `${input.quickStart.destino}${input.quickStart.dataIda ? ` · ${input.quickStart.dataIda}` : ''}`
    : (firstMessage ? firstMessage.slice(0, 60) : 'Nova conversa')

  const { data: row, error: insertError } = await supabase
    .from('roteiro_generations')
    .insert({
      organization_id: org.id,
      created_by: user.id,
      title,
      mode: input.quickStart?.mode || null,
      destino: input.quickStart?.destino?.trim() || null,
      data_ida: input.quickStart?.dataIda || null,
      data_volta: input.quickStart?.dataVolta || null,
      pax_adults: input.quickStart?.paxAdults ?? 2,
      pax_children: input.quickStart?.paxChildren ?? 0,
      status: firstMessage ? 'generating' : 'done',
    })
    .select('id')
    .single()

  if (insertError || !row) return { ok: false, error: insertError?.message || 'Erro ao criar o roteiro.' }

  if (firstMessage) {
    const res = await sendRoteiroMessage(orgSlug, row.id, firstMessage)
    if (!res.ok) return { ok: false, error: res.error }
  }

  return { ok: true, id: row.id }
}

/** Envia uma mensagem na conversa (nova ou existente) e retorna a resposta da IA. */
export async function sendRoteiroMessage(
  orgSlug: string,
  roteiroId: string,
  message: string,
): Promise<{ ok: true; reply: string } | { ok: false; error: string }> {
  const access = await requireRoteiristaAccess(orgSlug)
  if (!access.ok) return access
  const { org } = access
  if (!message?.trim()) return { ok: false, error: 'Escreva uma mensagem.' }
  if (!hasGeminiKey()) return { ok: false, error: 'IA (Gemini) não configurada.' }

  const supabase = createClient()
  const { data: roteiro } = await supabase
    .from('roteiro_generations')
    .select('id')
    .eq('organization_id', org.id)
    .eq('id', roteiroId)
    .maybeSingle()
  if (!roteiro) return { ok: false, error: 'Conversa não encontrada.' }

  const accountId = (org as any).account_id as string | null
  if (accountId) {
    const credit = await consumeAiCredits({ accountId, action: 'roteirista_generate', metadata: { feature: 'roteirista', orgSlug } })
    if (!credit.success) {
      return {
        ok: false,
        error: credit.error === 'insufficient_credits'
          ? 'Seus créditos de IA acabaram este mês. Faça upgrade ou aguarde a renovação.'
          : 'Não foi possível validar seus créditos de IA. Tente novamente.',
      }
    }
  }

  await supabase.from('roteiro_generations').update({ status: 'generating' }).eq('id', roteiroId)
  await supabase.from('roteiro_messages').insert({
    roteiro_id: roteiroId, organization_id: org.id, role: 'user', content: message.trim(),
  })

  const { data: priorMessages } = await supabase
    .from('roteiro_messages')
    .select('role, content')
    .eq('roteiro_id', roteiroId)
    .order('created_at', { ascending: true })

  const history: RoteiroChatTurn[] = (priorMessages || []) as RoteiroChatTurn[]
  const knowledgeContext = await loadKnowledgeContext(supabase, org.id)

  try {
    const reply = await sendRoteiroChatMessage(getGeminiKey(), history, knowledgeContext)
    await supabase.from('roteiro_messages').insert({
      roteiro_id: roteiroId, organization_id: org.id, role: 'assistant', content: reply,
    })
    await supabase.from('roteiro_generations').update({ result_html: reply, status: 'done' }).eq('id', roteiroId)
    revalidatePath(`/app/${orgSlug}/roteirista`)
    return { ok: true, reply }
  } catch (err: any) {
    const errorMessage = err?.message || 'Erro ao gerar a resposta com IA.'
    await supabase.from('roteiro_generations').update({ status: 'error', error_message: errorMessage }).eq('id', roteiroId)
    revalidatePath(`/app/${orgSlug}/roteirista`)
    return { ok: false, error: errorMessage }
  }
}

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

// ── Base de conhecimento do Roteirista ──────────────────────────────────────

export type RoteiristaKnowledgeItem = {
  id: string
  content: string
  is_active: boolean
  created_at: string
}

export async function listRoteiristaKnowledge(orgSlug: string): Promise<RoteiristaKnowledgeItem[]> {
  const access = await requireRoteiristaAccess(orgSlug)
  if (!access.ok) return []
  const supabase = createClient()
  const { data } = await supabase
    .from('roteirista_knowledge_items')
    .select('id, content, is_active, created_at')
    .eq('organization_id', access.org.id)
    .order('created_at', { ascending: false })
  return (data || []) as RoteiristaKnowledgeItem[]
}

export async function addRoteiristaKnowledge(orgSlug: string, content: string) {
  const access = await requireRoteiristaAccess(orgSlug)
  if (!access.ok) return access
  if (!content?.trim()) return { ok: false as const, error: 'Escreva o conhecimento antes de salvar.' }

  const supabase = createClient()
  const { error } = await supabase.from('roteirista_knowledge_items').insert({
    organization_id: access.org.id,
    content: content.trim(),
  })
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/roteirista`)
  return { ok: true as const }
}

export async function deleteRoteiristaKnowledge(orgSlug: string, id: string) {
  const access = await requireRoteiristaAccess(orgSlug)
  if (!access.ok) return access
  const supabase = createClient()
  const { error } = await supabase
    .from('roteirista_knowledge_items')
    .delete()
    .eq('organization_id', access.org.id)
    .eq('id', id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/roteirista`)
  return { ok: true as const }
}
