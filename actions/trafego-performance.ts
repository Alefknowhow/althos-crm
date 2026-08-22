'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/supabase/types'

export type ClientPerformanceRow = {
  contatoId: string
  name: string
  source: string | null
  salesCount: number
  revenueCents: number
}

export type SourcePerformanceRow = {
  source: string
  salesCount: number
  revenueCents: number
}

export type TrafegoPerformance = {
  byClient: ClientPerformanceRow[]
  bySource: SourcePerformanceRow[]
}

/**
 * Vertical Agências de Tráfego — Etapa 2, Fase H. Performance real (vendas
 * dos últimos 30d, agrupadas por cliente e por origem do lead) — sem
 * ROAS/CAC (dependem de investimento em mídia, que não existe como dado
 * hoje; ver TrafegoTab.tsx pros mesmos estados "—" explicados).
 */
export async function getTrafegoPerformance(orgSlug: string): Promise<TrafegoPerformance> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const since30d = new Date()
  since30d.setDate(since30d.getDate() - 30)

  const { data: sales } = await supabase
    .from('sales')
    .select('amount_cents, contato_id, leads(id, name, source)')
    .eq('organization_id', org.id)
    .eq('status', 'completed')
    .gte('sale_date', since30d.toISOString().slice(0, 10))

  const byClientMap = new Map<string, ClientPerformanceRow>()
  const bySourceMap = new Map<string, SourcePerformanceRow>()

  for (const row of (sales || []) as any[]) {
    const lead = row.leads
    const amount = row.amount_cents || 0

    if (row.contato_id) {
      const existing = byClientMap.get(row.contato_id)
      if (existing) {
        existing.salesCount += 1
        existing.revenueCents += amount
      } else {
        byClientMap.set(row.contato_id, {
          contatoId: row.contato_id,
          name: lead?.name || 'Sem nome',
          source: lead?.source || null,
          salesCount: 1,
          revenueCents: amount,
        })
      }
    }

    const sourceKey = lead?.source || 'Sem origem'
    const existingSource = bySourceMap.get(sourceKey)
    if (existingSource) {
      existingSource.salesCount += 1
      existingSource.revenueCents += amount
    } else {
      bySourceMap.set(sourceKey, { source: sourceKey, salesCount: 1, revenueCents: amount })
    }
  }

  return {
    byClient: Array.from(byClientMap.values()).sort((a, b) => b.revenueCents - a.revenueCents).slice(0, 10),
    bySource: Array.from(bySourceMap.values()).sort((a, b) => b.revenueCents - a.revenueCents),
  }
}
