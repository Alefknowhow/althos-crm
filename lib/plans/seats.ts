/**
 * Custo de usuários adicionais além da franquia do plano — "5 de 5
 * incluídos" / "7 usuários: 5 incluídos + 2 adicionais = R$98/mês".
 * Fonte central: nenhum componente deve recalcular isso com valores
 * próprios (ver seção 10 de PRICING_ARCHITECTURE.md).
 *
 * Separado de lib/plans/config.ts (que ultrapassou o limite de 350 linhas
 * do lint) — mesma regra de negócio, arquivo próprio.
 */

import { getPlanMeta, type PlanId } from './config'

export interface SeatCost {
  totalUsers: number
  includedUsers: number
  extraUsers: number
  extraUserPriceCents: number
  extraCostCents: number
}

export function computeSeatCost(plan: PlanId | string | null | undefined, totalUsers: number): SeatCost {
  const meta = getPlanMeta(plan)
  const extraUsers = Math.max(0, totalUsers - meta.includedUsers)
  return {
    totalUsers,
    includedUsers: meta.includedUsers,
    extraUsers,
    extraUserPriceCents: meta.extraUserPriceCents,
    extraCostCents: extraUsers * meta.extraUserPriceCents,
  }
}
