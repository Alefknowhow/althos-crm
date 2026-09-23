/**
 * Estados de entitlement (issue #31) — distintos de billing state. Billing
 * state é o que o provedor de pagamento (Asaas) diz sobre a cobrança;
 * entitlement state é o que isso SIGNIFICA pra acesso ao produto. Hoje
 * `subscriptions.status` (lib/plans/server.ts) só distingue
 * active/trialing (=ativo) de tudo o resto (=inativo) — este módulo é a
 * tradução explícita pros 5 estados que a issue pede, sem mudar o schema:
 * é uma função pura sobre a subscription já lida, não uma nova tabela.
 *
 * NÃO substitui checkFeatureAccess (a fonte de verdade real continua sendo
 * a RPC account_has_feature, em SQL) — serve para UI/Super-Admin (#33)
 * exibirem o estado de forma consistente, e para código que precisa saber
 * "por que" o acesso está bloqueado, não só "se" está.
 */

export type EntitlementState =
  | 'active'
  | 'pending_activation'
  | 'pending_cancellation'
  | 'suspended'
  | 'inactive'

export interface SubscriptionLike {
  status: string
  trial_ends_at: string | null
  canceled_at: string | null
  current_period_end: string
}

export function resolveEntitlementState(sub: SubscriptionLike | null): EntitlementState {
  // Nenhuma subscription registrada ainda pra essa conta — nunca foi ativado.
  if (!sub) return 'pending_activation'

  if (sub.status === 'trialing') {
    const trialExpired = sub.trial_ends_at !== null && new Date(sub.trial_ends_at) < new Date()
    return trialExpired ? 'inactive' : 'active'
  }

  if (sub.status === 'active') {
    // canceled_at setado mas ainda dentro do período pago = vai encerrar no
    // fim do ciclo, mas continua com acesso até lá.
    if (sub.canceled_at && new Date(sub.current_period_end) >= new Date()) {
      return 'pending_cancellation'
    }
    return 'active'
  }

  if (sub.status === 'past_due') return 'suspended'

  // 'canceled' e qualquer status não reconhecido: sem acesso.
  return 'inactive'
}
