'use server'

import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import { checkMemberPermission } from '@/lib/permissions.server'
import { isTravelNiche } from '@/lib/niche'
import { generateRoteiro, type RoteiroMode } from '@/lib/ai/roteirista'
import { getGeminiKey, hasGeminiKey } from '@/lib/ai/api-key'
import { consumeAiCredits } from '@/lib/plans/server'
import { revalidatePath } from 'next/cache'

export type RoteiroGeneration = {
  id: string
  title: string
  mode: RoteiroMode
  destino: string
  data_ida: string | null
  data_volta: string | null
  periodo_flexivel: boolean
  mes_referencia: string | null
  pax_adults: number
  pax_children: number
  nivel_conforto: string | null
  orcamento_cents: number | null
  interesses: string | null
  observacoes: string | null
  result_html: string | null
  status: 'generating' | 'done' | 'error'
  error_message: string | null
  converted_quotation_id: string | null
  created_at: string
}

async function requireRoteiristaAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
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

export async function generateRoteiroAction(
  orgSlug: string,
  input: {
    mode: RoteiroMode
    destino: string
    dataIda: string | null
    dataVolta: string | null
    periodoFlexivel: boolean
    mesReferencia: string | null
    paxAdults: number
    paxChildren: number
    nivelConforto: string | null
    orcamentoCents: number | null
    interesses: string | null
    observacoes: string | null
  },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const access = await requireRoteiristaAccess(orgSlug)
  if (!access.ok) return access
  const { user, org } = access

  if (!input.destino?.trim()) return { ok: false, error: 'Informe o destino.' }
  if (!hasGeminiKey()) return { ok: false, error: 'IA (Gemini) não configurada.' }

  const supabase = createClient()

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

  const { data: knowledgeRows } = await supabase
    .from('roteirista_knowledge_items')
    .select('content')
    .eq('organization_id', org.id)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(200)
  const knowledgeContext = (knowledgeRows || []).map(r => `- ${r.content}`).join('\n')

  const title = `${input.destino}${input.dataIda ? ` · ${input.dataIda}` : ''}`

  const { data: row, error: insertError } = await supabase
    .from('roteiro_generations')
    .insert({
      organization_id: org.id,
      created_by: user.id,
      title,
      mode: input.mode,
      destino: input.destino.trim(),
      data_ida: input.dataIda || null,
      data_volta: input.dataVolta || null,
      periodo_flexivel: input.periodoFlexivel,
      mes_referencia: input.mesReferencia || null,
      pax_adults: input.paxAdults,
      pax_children: input.paxChildren,
      nivel_conforto: input.nivelConforto || null,
      orcamento_cents: input.orcamentoCents || null,
      interesses: input.interesses || null,
      observacoes: input.observacoes || null,
      status: 'generating',
    })
    .select('id')
    .single()

  if (insertError || !row) return { ok: false, error: insertError?.message || 'Erro ao criar o roteiro.' }

  try {
    const resultHtml = await generateRoteiro(getGeminiKey(), {
      mode: input.mode,
      destino: input.destino.trim(),
      dataIda: input.dataIda,
      dataVolta: input.dataVolta,
      periodoFlexivel: input.periodoFlexivel,
      mesReferencia: input.mesReferencia,
      paxAdults: input.paxAdults,
      paxChildren: input.paxChildren,
      nivelConforto: input.nivelConforto,
      orcamentoCents: input.orcamentoCents,
      interesses: input.interesses,
      observacoes: input.observacoes,
      knowledgeContext,
    })
    await supabase.from('roteiro_generations').update({ result_html: resultHtml, status: 'done' }).eq('id', row.id)
  } catch (err: any) {
    await supabase.from('roteiro_generations').update({
      status: 'error',
      error_message: err?.message || 'Erro ao gerar o roteiro com IA.',
    }).eq('id', row.id)
  }

  revalidatePath(`/app/${orgSlug}/roteirista`)
  return { ok: true, id: row.id }
}

export async function convertRoteiroToQuotation(orgSlug: string, roteiroId: string): Promise<{ ok: true; quotationId: string } | { ok: false; error: string }> {
  const access = await requireRoteiristaAccess(orgSlug)
  if (!access.ok) return access
  const cotacoesPerm = await checkMemberPermission(access.org.id, access.user.id, 'cotacoes')
  if (!cotacoesPerm.allowed) return { ok: false, error: cotacoesPerm.reason }

  const supabase = createClient()
  const { data: roteiro } = await supabase
    .from('roteiro_generations')
    .select('*')
    .eq('organization_id', access.org.id)
    .eq('id', roteiroId)
    .maybeSingle()
  if (!roteiro) return { ok: false, error: 'Roteiro não encontrado.' }

  const { data: quotation, error } = await supabase
    .from('travel_proposals')
    .insert({
      organization_id: access.org.id,
      created_by: access.user.id,
      contato_id: null,
      title: roteiro.title,
      destinations: roteiro.destino,
      start_date: roteiro.data_ida,
      end_date: roteiro.data_volta,
      pax_count: roteiro.pax_adults + roteiro.pax_children,
      itinerary_html: roteiro.result_html,
      is_offer: false,
      offer_published: false,
      status: 'draft',
    })
    .select('id')
    .single()

  if (error || !quotation) return { ok: false, error: error?.message || 'Erro ao criar a cotação.' }

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
