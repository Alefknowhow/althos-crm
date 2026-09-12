/**
 * Lógica pura extraída de app/api/webhooks/asaas/route.ts pra ser testável
 * sem mockar o handler HTTP inteiro (achado "testes faltando" da auditoria
 * de segurança — nenhum teste cobria o parsing de externalReference nem a
 * resolução de planKey antes desta extração).
 */

const KNOWN_PLAN_KEYS = ['starter', 'pro', 'business', 'scale'] as const
export type KnownPlanKey = (typeof KNOWN_PLAN_KEYS)[number]

/**
 * externalReference de um pacote avulso de créditos de IA tem o formato
 * "credit_pack:<accountId>:<credits>" (ver actions/billing.ts, onde é
 * gerado no checkout). Retorna null se o formato não bater ou os créditos
 * não forem um número válido — o caller deve ignorar o efeito colateral
 * nesse caso, nunca creditar um valor não numérico.
 */
export function parseCreditPackRef(externalRef: string | null | undefined): { accountId: string; credits: number } | null {
  if (!externalRef?.startsWith('credit_pack:')) return null
  const [, accountId, creditsStr] = externalRef.split(':')
  const credits = parseInt(creditsStr, 10)
  if (!accountId || !Number.isFinite(credits)) return null
  return { accountId, credits }
}

/**
 * Deriva a chave de plano a ativar a partir de organizations.plan — cai em
 * 'starter' pra qualquer valor fora do conjunto conhecido (org recém-criada
 * ainda em 'trial'/'free', por exemplo), nunca ativa um plano arbitrário
 * vindo do banco sem checagem.
 */
export function resolvePlanKeyFromOrg(orgPlan: string | null | undefined): KnownPlanKey {
  return (KNOWN_PLAN_KEYS as readonly string[]).includes(orgPlan ?? '')
    ? (orgPlan as KnownPlanKey)
    : 'starter'
}

/**
 * externalReference de uma compra de Email Credits tem o formato
 * "email_credits:<orgId>:<packId>:<timestamp>" (ver actions/email-credits.ts
 * ::purchaseEmailCredits — o timestamp existe só pra permitir comprar o
 * mesmo pacote 2x sem colidir external reference no Asaas, não é usado aqui).
 */
export function parseEmailCreditsRef(externalRef: string | null | undefined): { orgId: string; packId: string } | null {
  if (!externalRef?.startsWith('email_credits:')) return null
  const [, orgId, packId] = externalRef.split(':')
  if (!orgId || !packId) return null
  return { orgId, packId }
}

/** Chave de idempotência do evento Asaas — mesmo evento real sempre gera a mesma chave. */
export function buildAsaasDedupeKey(payload: { event?: string; payment?: { id?: string }; subscription?: { id?: string } }): string {
  return `${payload.event}:${payload.payment?.id || payload.subscription?.id || 'no-ref'}`
}
