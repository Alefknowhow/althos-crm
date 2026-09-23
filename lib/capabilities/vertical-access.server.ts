// Server-only. Ponte entre account_verticals (migration 0263, #32) e o
// resolver de capability (#31) — achado P1 da revisão automática da PR #38:
// grantVerticalToAccount/revokeVerticalFromAccount só escreviam em
// account_verticals; hasCapability continuava resolvendo verticais
// exclusivamente por organizations.niche, então uma concessão manual do
// Super Admin reportava sucesso sem realmente liberar nada.
//
// organizations.niche continua sendo a fonte "nativa" (imutável, definida
// no onboarding) — account_verticals é um caminho ALTERNATIVO: se a org já
// é da vertical nativamente, nada muda; se não é, mas a CONTA tem essa
// vertical concedida (compra ou concessão manual), o acesso também é
// liberado. Isto é enforcement server-side real (rotas/APIs/tools via
// hasCapability) — visibilidade de menu (isModuleEnabled síncrono, usado
// pelo Sidebar) continua só por niche nativo por enquanto; isso é
// consistente com o princípio da #31 ("esconder menu não é autorização"),
// não uma brecha de segurança — só significa que o item de menu pode
// demorar a aparecer até a Sidebar também ser migrada pra consultar isto.

import { createAdminClient } from '@/lib/supabase/server'
import { nicheKeyFor, type NicheKey } from '@/lib/niche'
import type { CapabilityKey } from './types'

/**
 * Texto livre canônico por vertical — precisa bater com o que
 * `nicheKeyFor`/`isXNiche()` (lib/niche.ts) já reconhecem via substring,
 * já que essas funções trabalham sobre o texto livre de
 * `organizations.niche`, não sobre o NicheKey curto (que por si só NÃO
 * bate — ex.: 'imoveis' não contém 'imob', o substring que
 * isRealEstateNiche procura). Coberto por teste
 * (tests/unit/vertical-access.test.ts) pra pegar qualquer drift futuro em
 * lib/niche.ts antes que vire um bypass silencioso.
 */
const CANONICAL_NICHE_TEXT: Record<NicheKey, string> = {
  viagens: 'viagens',
  clinicas: 'Clínicas',
  imoveis: 'Imobiliária',
  seguros: 'seguros',
  trafego: 'trafego',
  advocacia: 'advocacia',
}

export function canonicalNicheText(vertical: NicheKey): string {
  return CANONICAL_NICHE_TEXT[vertical]
}

/** Qual vertical uma capability representa, deduzido do próprio nome — 'vertical.travel.cotacoes' → 'viagens', 'core.*' → null (não é vertical nenhuma). */
export function verticalFromCapabilityKey(key: CapabilityKey): NicheKey | null {
  if (key === 'vertical.travel' || key.startsWith('vertical.travel.')) return 'viagens'
  if (key === 'vertical.clinic' || key.startsWith('vertical.clinic.')) return 'clinicas'
  if (key === 'vertical.real_estate') return 'imoveis'
  if (key === 'vertical.insurance') return 'seguros'
  if (key === 'vertical.traffic') return 'trafego'
  return null
}

/** True se a CONTA (não a org) tem essa vertical com status 'active' em account_verticals. */
export async function hasActiveAccountVertical(accountId: string, vertical: NicheKey): Promise<boolean> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('account_verticals')
    .select('status')
    .eq('account_id', accountId)
    .eq('vertical', vertical)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data?.status === 'active'
}

/**
 * Resolve a "vertical efetiva" pra fins de gate por nicho: se a org já é
 * nativamente dessa vertical, devolve o niche real (sem mudar nada); senão,
 * só se a conta tiver a vertical concedida, devolve o texto canônico (fazendo
 * isModuleEnabled/nicheKeyFor "verem" a org como se fosse dessa vertical
 * pros fins desta checagem específica). Non-vertical capabilities (core.*)
 * devolvem sempre o niche real, sem tocar em account_verticals.
 */
export async function resolveEffectiveNiche(
  key: CapabilityKey,
  orgNiche: string | null,
  accountId: string | null,
): Promise<string | null> {
  const vertical = verticalFromCapabilityKey(key)
  if (!vertical) return orgNiche
  if (nicheKeyFor(orgNiche) === vertical) return orgNiche
  if (accountId && (await hasActiveAccountVertical(accountId, vertical))) {
    return canonicalNicheText(vertical)
  }
  return orgNiche
}
