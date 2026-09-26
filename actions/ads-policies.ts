'use server'

/**
 * Guardrails de autonomia pra mutation tools de Ads (issue #22, passo 3.4)
 * — lidos pela tool de mutação (3.8, ainda bloqueada por falta de
 * ads_management/App Review) antes de enfileirar uma aprovação. UI de
 * edição fica pra quando a 3.8 existir de verdade (não faz sentido expor
 * uma tela pra configurar limites de uma ação que ainda não pode ser
 * executada).
 */

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'

export type AdsPolicy = {
  maxBudgetChangePct: number
  allowPause: boolean
  allowBudgetChange: boolean
  autonomyLevel: 'read' | 'draft' | 'low_risk' | 'full_approval'
}

const DEFAULT_POLICY: AdsPolicy = { maxBudgetChangePct: 30, allowPause: true, allowBudgetChange: false, autonomyLevel: 'draft' }

async function requireAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'trafego')
  if (!check.allowed) throw new Error(check.reason || 'Sem permissão')
  return org
}

export async function getAdsPolicy(orgSlug: string): Promise<AdsPolicy> {
  const org = await requireAccess(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('ads_policies')
    .select('max_budget_change_pct, allow_pause, allow_budget_change, autonomy_level')
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!data) return DEFAULT_POLICY
  return {
    maxBudgetChangePct: data.max_budget_change_pct,
    allowPause: data.allow_pause,
    allowBudgetChange: data.allow_budget_change,
    autonomyLevel: data.autonomy_level,
  }
}

const policySchema = z.object({
  maxBudgetChangePct: z.number().int().min(1).max(100),
  allowPause: z.boolean(),
  allowBudgetChange: z.boolean(),
  autonomyLevel: z.enum(['read', 'draft', 'low_risk', 'full_approval']),
})

export async function saveAdsPolicy(orgSlug: string, raw: unknown) {
  const org = await requireAccess(orgSlug)
  const parsed = policySchema.safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: 'Dados inválidos: ' + parsed.error.issues[0]?.message }

  const supabase = createClient()
  const { error } = await supabase.from('ads_policies').upsert(
    {
      organization_id: org.id,
      max_budget_change_pct: parsed.data.maxBudgetChangePct,
      allow_pause: parsed.data.allowPause,
      allow_budget_change: parsed.data.allowBudgetChange,
      autonomy_level: parsed.data.autonomyLevel,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'organization_id' },
  )
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}

/** Checagem que a tool de mutação (3.8) vai chamar antes de enfileirar
 *  qualquer aprovação — nunca confia no que o agente/LLM "decidiu" fazer. */
export async function checkAdsPolicyForMutation(
  supabaseAdmin: { from: (table: string) => any },
  orgId: string,
  mutation: 'pause' | 'resume' | 'budget_change',
  budgetChangePct?: number,
): Promise<{ allowed: true } | { allowed: false; reason: string }> {
  const { data } = await supabaseAdmin
    .from('ads_policies')
    .select('max_budget_change_pct, allow_pause, allow_budget_change, autonomy_level')
    .eq('organization_id', orgId)
    .maybeSingle()
  const policy = data
    ? { maxBudgetChangePct: data.max_budget_change_pct, allowPause: data.allow_pause, allowBudgetChange: data.allow_budget_change, autonomyLevel: data.autonomy_level }
    : DEFAULT_POLICY

  if (policy.autonomyLevel === 'read') return { allowed: false, reason: 'Autonomia da org configurada como somente leitura' }
  if ((mutation === 'pause' || mutation === 'resume') && !policy.allowPause) return { allowed: false, reason: 'Pausar/retomar campanhas desativado nas políticas da org' }
  if (mutation === 'budget_change') {
    if (!policy.allowBudgetChange) return { allowed: false, reason: 'Mudança de orçamento desativada nas políticas da org' }
    if (budgetChangePct != null && Math.abs(budgetChangePct) > policy.maxBudgetChangePct) {
      return { allowed: false, reason: `Mudança de ${budgetChangePct}% excede o limite configurado (${policy.maxBudgetChangePct}%)` }
    }
  }
  return { allowed: true }
}
