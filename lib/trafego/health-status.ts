/**
 * Regra de status de saúde de um cliente de tráfego — comparação simples e
 * determinística entre o resultado real (CPL/ROAS do período) e a meta
 * configurada pelo gestor (traffic_client_profile.targetCpl/targetRoas).
 *
 * Função pura, sem I/O — usada tanto pelos cards da tela principal
 * (app/app/[orgSlug]/agencias-trafego/trafego/page.tsx) quanto pela aba
 * Visão Geral/Inteligência do cliente, e é o ponto de partida natural pra
 * uma tool `get_client_health` na Agent Layer no futuro (hoje a Agent Layer
 * só expõe os números crus via get_client_performance/get_client_targets —
 * ver lib/agent/tools/clients.ts).
 */

export type HealthStatus = 'saudavel' | 'atencao' | 'critico' | 'sem_dados'

export const HEALTH_LABEL: Record<HealthStatus, string> = {
  saudavel: 'Saudável',
  atencao: 'Atenção',
  critico: 'Crítico',
  sem_dados: 'Sem dados',
}

export const HEALTH_DOT_CLASS: Record<HealthStatus, string> = {
  saudavel: 'bg-emerald-500',
  atencao: 'bg-amber-500',
  critico: 'bg-red-500',
  sem_dados: 'bg-zinc-400',
}

export const HEALTH_BADGE_CLASS: Record<HealthStatus, string> = {
  saudavel: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
  atencao: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  critico: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
  sem_dados: 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800/40 dark:text-zinc-300 dark:border-zinc-700',
}

export function computeClientHealthStatus(input: {
  investmentCents: number
  cplCents: number | null
  targetCpl: number | null // em reais (mesma unidade salva em traffic_client_profile.targetCpl)
  roas: number | null
  targetRoas: number | null
}): HealthStatus {
  const { investmentCents, cplCents, targetCpl, roas, targetRoas } = input
  if (investmentCents <= 0) return 'sem_dados'

  let worst: HealthStatus = 'saudavel'

  if (cplCents != null && targetCpl != null && targetCpl > 0) {
    const ratio = (cplCents / 100) / targetCpl
    if (ratio >= 1.5) worst = 'critico'
    else if (ratio >= 1.15) worst = 'atencao'
  }

  if (roas != null && targetRoas != null && targetRoas > 0) {
    const ratio = roas / targetRoas
    if (ratio <= 0.5) worst = 'critico'
    else if (ratio <= 0.85 && (worst as HealthStatus) !== 'critico') worst = 'atencao'
  }

  return worst
}
