'use server'

/**
 * Construtor de público das Campanhas de Envio — filtro sobre `contatos` +
 * pré-visualização (contagem e lista de verdade, pro checkbox antes do
 * disparo). Separado de actions/send-campaigns.ts (CRUD/ciclo de vida da
 * campanha) só por tamanho de arquivo — buildAudienceQuery é reexportada
 * porque materializeAndScheduleCampaign também precisa dela.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import type { AudienceFilter } from '@/lib/campaigns/audience-filter'

export type { AudienceFilter } from '@/lib/campaigns/audience-filter'

export async function buildAudienceQuery(
  supabase: ReturnType<typeof createClient>, orgId: string, filter: AudienceFilter,
  opts?: { orderByName?: boolean; limit?: number },
) {
  let q = supabase
    .from('contatos')
    .select('id, name, phone, email, status, tags', { count: 'exact' })
    .eq('organization_id', orgId)

  if (filter.tags.length > 0) q = q.overlaps('tags', filter.tags)
  if (filter.stageIds.length > 0) q = q.in('stage_id', filter.stageIds)
  if (filter.pipelineId) q = q.eq('pipeline_id', filter.pipelineId)
  if (filter.status?.length > 0) q = q.in('status', filter.status)
  if (filter.sources?.length > 0) q = q.in('source', filter.sources)
  if (filter.tier === 'hot' || filter.tier === 'warm' || filter.tier === 'cold') q = q.eq('ai_tier', filter.tier)
  if (filter.hasEmail) q = q.not('email', 'is', null)
  if (filter.hasPhone) q = q.not('phone', 'is', null)
  if (filter.createdFrom) q = q.gte('created_at', filter.createdFrom)
  if (filter.createdTo) q = q.lte('created_at', `${filter.createdTo}T23:59:59`)
  if (filter.valueMin > 0) q = q.gte('value_cents', filter.valueMin * 100)
  if (filter.valueMax > 0) q = q.lte('value_cents', filter.valueMax * 100)
  if (filter.noContactDays > 0) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - filter.noContactDays)
    q = q.lt('updated_at', cutoff.toISOString())
  }

  if (opts?.orderByName) q = q.order('name', { ascending: true })
  if (opts?.limit) q = q.limit(opts.limit)

  return q
}

/** Tags distintas usadas pelos contatos da org — alimenta o checklist do construtor de público. */
export async function listDistinctTags(orgSlug: string) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data } = await supabase
    .from('contatos')
    .select('tags')
    .eq('organization_id', org.id)
    .not('tags', 'is', null)

  const set = new Set<string>()
  for (const row of data || []) {
    for (const tag of (row.tags as string[] | null) || []) {
      if (tag) set.add(tag)
    }
  }
  return Array.from(set).sort()
}

/** Origens distintas usadas pelos contatos da org — mesmo papel de
 *  listDistinctTags, pro filtro de origem do construtor de público. */
export async function listDistinctSources(orgSlug: string) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data } = await supabase
    .from('contatos')
    .select('source')
    .eq('organization_id', org.id)
    .not('source', 'is', null)

  const set = new Set<string>()
  for (const row of data || []) {
    if (row.source) set.add(row.source as string)
  }
  return Array.from(set).sort()
}

export async function previewAudienceCount(orgSlug: string, filter: AudienceFilter) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const q = await buildAudienceQuery(supabase, org.id, filter)
  const { count } = await q
  return count || 0
}

const AUDIENCE_PREVIEW_LIMIT = 2000

export interface AudienceRecipientPreview {
  id: string
  name: string | null
  phone: string | null
  email: string | null
  status: string | null
  tags: string[] | null
}

/** Lista de verdade dos contatos que batem no filtro (não só a contagem)
 *  — alimenta a pré-visualização com checkbox antes do disparo. Corta em
 *  AUDIENCE_PREVIEW_LIMIT pra não puxar um público gigante pro navegador;
 *  `truncated` avisa a UI quando isso aconteceu. */
export async function previewAudienceRecipients(orgSlug: string, filter: AudienceFilter) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data, count } = await buildAudienceQuery(supabase, org.id, filter, { orderByName: true, limit: AUDIENCE_PREVIEW_LIMIT })
  return {
    recipients: (data || []) as AudienceRecipientPreview[],
    total: count || 0,
    truncated: (count || 0) > AUDIENCE_PREVIEW_LIMIT,
  }
}
