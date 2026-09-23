// Server-only — usa checkFeatureAccess (RPC) e getDisabledModulesForNiche
// (admin client). DO NOT import from Client Components.

import { canAccess, type MemberRole, type Permissions } from '@/lib/permissions'
import { checkFeatureAccess } from '@/lib/plans/server'
import { isModuleEnabled, type ModuleKey } from '@/lib/niche-modules'
import { getDisabledModulesForNiche } from '@/lib/module-flags'
import { nicheKeyFor } from '@/lib/niche'
import { resolveEffectiveNiche } from './vertical-access.server'
import { CAPABILITY_REGISTRY } from './registry'
import type { CapabilityKey, CapabilityRule } from './types'

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

  // Verticais compradas/concedidas via account_verticals (#32/#33) contam
  // como se a org fosse nativamente dessa vertical, além do
  // organizations.niche nativo — achado P1 da revisão automática da PR #38:
  // sem isto, "conceder vertical" no Super Admin gravava a linha mas não
  // liberava nada de verdade. Só afeta capabilities vertical.* (core.* usa
  // o niche real sem alteração).
  const effectiveNiche = await resolveEffectiveNiche(key, ctx.niche, ctx.accountId)
  const effectiveCtx: CapabilityContext = effectiveNiche === ctx.niche ? ctx : { ...ctx, niche: effectiveNiche }

  // `anyOf`: caminhos alternativos (ex.: core.conversations — permissão de
  // WhatsApp OU de Social/Instagram, cada um com seu próprio feature flag).
  // Passa se QUALQUER alternativa passar; nenhuma outra regra no nível
  // superior é avaliada junto (achado da revisão automática da PR #36: o
  // modelo original só suportava AND de um único permission/feature/module,
  // então core.conversations só refletia a metade WhatsApp do produto real).
  if (rule.anyOf) {
    const results = await Promise.all(rule.anyOf.map(sub => evaluateRule(effectiveCtx, sub)))
    const pass = results.find(r => r.allowed)
    if (pass) return pass
    return { allowed: false, reason: `Nenhum dos critérios alternativos de "${key}" foi atendido.` }
  }

  return evaluateRule(effectiveCtx, rule)
}

async function evaluateRule(ctx: CapabilityContext, rule: CapabilityRule): Promise<CapabilityCheck> {
  if (rule.requiresNiche && nicheKeyFor(ctx.niche) !== rule.requiresNiche) {
    return { allowed: false, reason: `Disponível apenas para organizações da vertical "${rule.requiresNiche}".` }
  }

  if (rule.permission && !canAccess(ctx.role, ctx.permissions, rule.permission)) {
    return { allowed: false, reason: `Sem permissão para o módulo "${rule.permission}".` }
  }

  if (rule.module) {
    let disabled: ModuleKey[]
    try {
      disabled = await getDisabledModulesForNiche(ctx.niche)
    } catch (e: any) {
      // Fail-closed de verdade: se não dá pra saber o estado do
      // kill-switch, não presume que nada está desabilitado (achado da
      // revisão automática da PR #36 — getDisabledModules() antes
      // descartava o erro e devolvia {} nesse caso).
      return { allowed: false, reason: `Não foi possível verificar o estado do módulo "${rule.module}": ${e?.message || 'erro desconhecido'}.` }
    }
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
