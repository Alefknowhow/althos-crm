'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { checkFeatureAccessByOrgSlug, consumeAiCredits, getAccountIdForOrgSlug } from '@/lib/plans/server'
import { getPlatformAiKey } from '@/lib/ai/api-key'
import { matchProperties, type MatcherCandidate } from '@/lib/ai/property-matcher'
import type { PropertyPreferences } from './property-preferences'

/**
 * Matching de imóveis por IA (Vertical Imobiliárias, Fase 4) — sob
 * demanda, sem persistência. Pré-filtra candidatos via SQL a partir das
 * preferências do lead (contatos.property_preferences), depois manda
 * pra IA rankear com score + motivo. Reaproveita o feature gate
 * 'lead_scoring' já existente em vez de criar um FeatureKey novo — é a
 * mesma categoria de recurso (IA sobre lead).
 */

export type MatchSuggestion = {
  propertyId: string
  title: string
  code: string | null
  score: number
  reason: string
}

const CANDIDATE_LIMIT = 30
const RESULT_LIMIT = 10

export async function matchPropertiesForLead(orgSlug: string, contatoId: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const access = await checkMemberPermission(org.id, user.id, 'imoveis')
  if (!access.allowed) return { ok: false as const, error: access.reason || 'Sem permissão' }

  const supabase = createClient()

  const { data: contato } = await supabase
    .from('contatos')
    .select('name, property_preferences')
    .eq('id', contatoId).eq('organization_id', org.id)
    .maybeSingle()
  if (!contato) return { ok: false as const, error: 'Lead não encontrado' }
  const prefs = (contato.property_preferences as PropertyPreferences | null) || null

  const accountId = await getAccountIdForOrgSlug(orgSlug)
  if (!accountId) return { ok: false as const, error: 'Conta não encontrada' }

  const allowed = await checkFeatureAccessByOrgSlug(orgSlug, 'lead_scoring')
  if (!allowed) return { ok: false as const, error: 'Matching por IA não está disponível no plano desta conta.' }

  let query = supabase
    .from('properties')
    .select('id, title, code, property_type, purpose, price_cents, city, neighborhood, bedrooms, parking_spots, features')
    .eq('organization_id', org.id)
    .eq('status', 'disponivel')

  if (prefs?.purpose && prefs.purpose !== 'qualquer') {
    query = query.in('purpose', [prefs.purpose, 'venda_locacao'])
  }
  if (prefs?.priceMin) query = query.gte('price_cents', prefs.priceMin)
  if (prefs?.priceMax) query = query.lte('price_cents', prefs.priceMax)
  if (prefs?.bedroomsMin) query = query.gte('bedrooms', prefs.bedroomsMin)
  if (prefs?.city) query = query.ilike('city', `%${prefs.city}%`)
  if (prefs?.neighborhood) query = query.ilike('neighborhood', `%${prefs.neighborhood}%`)
  if (prefs?.propertyType) query = query.ilike('property_type', `%${prefs.propertyType}%`)

  const { data: rows } = await query.order('updated_at', { ascending: false }).limit(CANDIDATE_LIMIT)
  if (!rows || rows.length === 0) {
    return { ok: false as const, error: 'Nenhum imóvel disponível compatível com o pré-filtro encontrado.' }
  }

  const apiKey = getPlatformAiKey()
  if (!apiKey) return { ok: false as const, error: 'IA temporariamente indisponível. Tente novamente em instantes.' }

  const credit = await consumeAiCredits({
    accountId, action: 'property_matching', leadId: contatoId, metadata: { orgId: org.id },
  })
  if (!credit.success) return { ok: false as const, error: 'Créditos de IA esgotados para esta conta neste mês.' }

  const candidates: MatcherCandidate[] = rows.map((r: any) => ({
    id: r.id, title: r.title, code: r.code, propertyType: r.property_type, purpose: r.purpose,
    priceCents: r.price_cents, city: r.city, neighborhood: r.neighborhood, bedrooms: r.bedrooms,
    parkingSpots: r.parking_spots, features: r.features,
  }))

  try {
    const { result } = await matchProperties(
      { lead: { name: contato.name, preferences: prefs }, candidates },
      { apiKey, model: 'claude-sonnet-5' },
    )
    const byId = new Map(candidates.map(c => [c.id, c]))
    const suggestions: MatchSuggestion[] = result
      .slice(0, RESULT_LIMIT)
      .map(m => ({
        propertyId: m.propertyId,
        title: byId.get(m.propertyId)?.title || '',
        code: byId.get(m.propertyId)?.code ?? null,
        score: m.score,
        reason: m.reason,
      }))
    return { ok: true as const, suggestions }
  } catch (e: any) {
    return { ok: false as const, error: e?.message || 'Erro ao rodar o matching por IA' }
  }
}
