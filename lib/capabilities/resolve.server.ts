// Server-only — usa checkFeatureAccess (RPC) e getDisabledModulesForNiche
// (admin client). DO NOT import from Client Components.

import { canAccess, type MemberRole, type Permissions } from '@/lib/permissions'
import { checkFeatureAccess } from '@/lib/plans/server'
import { isModuleEnabled } from '@/lib/niche-modules'
import { getDisabledModulesForNiche } from '@/lib/module-flags'
import { nicheKeyFor } from '@/lib/niche'
import { CAPABILITY_REGISTRY } from './registry'
import type { CapabilityKey } from './types'

export interface CapabilityContext {
  accountId: string | null
  niche: string | null
  role: MemberRole
  permissions: Permissions
}

export type CapabilityCheck = { allowed: true } | { allowed: false; reason: string }

/**
 * Ponto ÚNICO de autorização por capability (issue #31) — Navigation,
 * Routes, APIs, IA/Tools e Automações devem chamar isto em vez de
 * reimplementar a combinação de permissão + plano + nicho/kill-switch cada
 * um do seu jeito (auditoria #31 encontrou 4 sistemas checados em ordens
 * e subconjuntos diferentes por arquivo). Fail-closed: capability
 * desconhecida ou qualquer regra presente que falhe nega o acesso.
 */
export async function hasCapability(ctx: CapabilityContext, key: CapabilityKey): Promise<CapabilityCheck> {
  const rule = CAPABILITY_REGISTRY[key]
  if (!rule) {
    return { allowed: false, reason: `Capability desconhecida: "${key}".` }
  }

  if (rule.requiresNiche && nicheKeyFor(ctx.niche) !== rule.requiresNiche) {
    return { allowed: false, reason: `Disponível apenas para organizações da vertical "${rule.requiresNiche}".` }
  }

  if (rule.permission && !canAccess(ctx.role, ctx.permissions, rule.permission)) {
    return { allowed: false, reason: `Sem permissão para o módulo "${rule.permission}".` }
  }

  if (rule.module) {
    const disabled = await getDisabledModulesForNiche(ctx.niche)
    if (!isModuleEnabled(ctx.niche, rule.module, disabled)) {
      return { allowed: false, reason: `Módulo "${rule.module}" não disponível para esta organização.` }
    }
  }

  if (rule.feature) {
    if (!ctx.accountId) {
      return { allowed: false, reason: 'Organização sem conta de cobrança associada.' }
    }
    const ok = await checkFeatureAccess(ctx.accountId, rule.feature)
    if (!ok) {
      return { allowed: false, reason: `Recurso "${rule.feature}" não incluído no plano atual.` }
    }
  }

  return { allowed: true }
}
