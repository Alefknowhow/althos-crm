/**
 * Alertas/recomendações computados em runtime a partir da performance real
 * vs. metas do cliente (traffic_client_profile) — sem tabela persistente
 * nesta fase (ver plano em C:\Users\aleft\.claude\plans\dazzling-baking-anchor.md,
 * seção "Fora de escopo"). Função pura, reaproveitada pela aba Visão Geral
 * (Recomendações) e pela aba Inteligência (Alertas).
 */

import type { ClientPerformanceSummary } from '@/actions/trafego-performance'
import type { TrafficClientProfile } from '@/actions/traffic-client-profile'

export type ClientAlert = {
  severity: 'atencao' | 'critico'
  title: string
  reason: string
}

export function computeClientAlerts(
  curr: ClientPerformanceSummary,
  prev: ClientPerformanceSummary,
  profile: TrafficClientProfile | null,
  lastSyncDaysAgo: number | null,
): ClientAlert[] {
  const out: ClientAlert[] = []

  if (lastSyncDaysAgo != null && lastSyncDaysAgo >= 3) {
    out.push({
      severity: lastSyncDaysAgo >= 7 ? 'critico' : 'atencao',
      title: 'Conta sem sincronizar',
      reason: `Última sincronização há ${lastSyncDaysAgo} dia${lastSyncDaysAgo === 1 ? '' : 's'}.`,
    })
  }

  if (curr.investmentCents === 0 && prev.investmentCents > 0) {
    out.push({ severity: 'critico', title: 'Campanha sem entrega', reason: 'Não houve investimento registrado no período atual, mas havia no anterior.' })
  }

  if (profile?.targetCpl && curr.cplCents != null) {
    const ratio = (curr.cplCents / 100) / profile.targetCpl
    if (ratio >= 1.5) out.push({ severity: 'critico', title: 'CPL muito acima da meta', reason: `CPL ${((ratio - 1) * 100).toFixed(0)}% acima do máximo configurado.` })
    else if (ratio >= 1.15) out.push({ severity: 'atencao', title: 'CPL acima da meta', reason: `CPL ${((ratio - 1) * 100).toFixed(0)}% acima da meta.` })
  }

  if (profile?.targetRoas && curr.roas != null) {
    const ratio = curr.roas / profile.targetRoas
    if (ratio <= 0.5) out.push({ severity: 'critico', title: 'ROAS muito abaixo da meta', reason: `ROAS atual (${curr.roas.toFixed(1)}x) bem abaixo do mínimo configurado (${profile.targetRoas}x).` })
    else if (ratio <= 0.85) out.push({ severity: 'atencao', title: 'ROAS abaixo da meta', reason: `ROAS atual (${curr.roas.toFixed(1)}x) abaixo do mínimo configurado (${profile.targetRoas}x).` })
  }

  if (prev.leads > 0 && curr.leads > 0) {
    const dropRatio = curr.leads / prev.leads
    if (dropRatio <= 0.6) out.push({ severity: 'atencao', title: 'Queda brusca de leads', reason: `Leads caíram ${((1 - dropRatio) * 100).toFixed(0)}% em relação ao período anterior.` })
  }

  if (prev.cpmCents != null && curr.cpmCents != null && prev.cpmCents > 0) {
    const cpmChange = (curr.cpmCents - prev.cpmCents) / prev.cpmCents
    if (cpmChange >= 0.3) out.push({ severity: 'atencao', title: 'Aumento anormal de CPM', reason: `CPM subiu ${(cpmChange * 100).toFixed(0)}% em relação ao período anterior.` })
  }

  return out
}

export type ClientInsight = { text: string }

export function computeClientInsights(curr: ClientPerformanceSummary, prev: ClientPerformanceSummary): ClientInsight[] {
  const out: ClientInsight[] = []
  if (curr.investmentCents === 0) return out

  function pct(a: number, b: number): number | null {
    if (b === 0) return null
    return ((a - b) / b) * 100
  }

  const cpmChange = curr.cpmCents != null && prev.cpmCents != null ? pct(curr.cpmCents, prev.cpmCents) : null
  if (cpmChange !== null && Math.abs(cpmChange) >= 15) out.push({ text: `CPM ${cpmChange >= 0 ? 'aumentou' : 'caiu'} ${Math.abs(cpmChange).toFixed(0)}%.` })

  const ctrChange = curr.ctr != null && prev.ctr != null ? pct(curr.ctr, prev.ctr) : null
  if (ctrChange !== null && Math.abs(ctrChange) >= 15) out.push({ text: `CTR ${ctrChange >= 0 ? 'subiu' : 'caiu'} ${Math.abs(ctrChange).toFixed(0)}%.` })

  const leadsChange = pct(curr.leads, prev.leads)
  if (leadsChange !== null && Math.abs(leadsChange) >= 15) out.push({ text: `Leads ${leadsChange >= 0 ? 'cresceram' : 'caíram'} ${Math.abs(leadsChange).toFixed(0)}% no período.` })

  return out
}
