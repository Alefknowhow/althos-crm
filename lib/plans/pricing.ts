/**
 * Resolve quanto uma ação de IA custa em créditos, lendo o catálogo AO VIVO
 * (ai_action_cost_catalog.credits_cost — editável no super-admin, ver
 * app/super-admin/ai-credits) em vez do valor estático AI_CREDIT_COST.
 * Fallback pro estático quando a ação não está cadastrada no catálogo
 * (ex.: ambiente sem a migration 0214, ou ação nova ainda não catalogada).
 *
 * Cache em memória de processo (TTL curto) — evita 1 round-trip ao banco por
 * mensagem de WhatsApp/Instagram; editar o catálogo no super-admin demora até
 * CREDIT_COST_CACHE_TTL_MS pra refletir em produção.
 */

import { createClient } from '@/lib/supabase/server'
import { AI_CREDIT_COST, type AiAction } from '@/lib/plans/config'

const CREDIT_COST_CACHE_TTL_MS = 60_000

let cache: { data: Map<string, number>; expiresAt: number } | null = null

async function loadCreditCostMap(): Promise<Map<string, number>> {
  if (cache && cache.expiresAt > Date.now()) return cache.data

  const supabase = createClient()
  const { data } = await supabase.from('ai_action_cost_catalog').select('action_key, credits_cost')
  const map = new Map<string, number>((data || []).map(r => [r.action_key, r.credits_cost]))
  cache = { data: map, expiresAt: Date.now() + CREDIT_COST_CACHE_TTL_MS }
  return map
}

/** Custo-base (em créditos) de uma ação, antes do multiplicador de modelo. */
export async function resolveActionCreditCost(action: AiAction | string): Promise<number> {
  try {
    const map = await loadCreditCostMap()
    const fromCatalog = map.get(action)
    if (fromCatalog != null) return fromCatalog
  } catch {
    // Catálogo indisponível (migration não aplicada, erro de rede) — cai no
    // fallback estático abaixo, sem quebrar a cobrança.
  }
  return AI_CREDIT_COST[action as AiAction] ?? 1
}
