'use server'

import { cache } from 'react'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'
import { generateInsightsForOrg } from '@/lib/dashboard/insights-detectors'

export type DashboardInsight = {
  id: string
  kind: 'opportunity' | 'risk' | 'info'
  icon: string | null
  text: string
  deep_link: string | null
  score: number
  created_at: string
}

// cache() deduplica por argumento DENTRO do mesmo request/render — o
// Dashboard chama isso uma vez no page.tsx (pro InsightsStrip) e de novo
// dentro do InsightCard da aba ativa; sem isso eram 2 queries idênticas na
// mesma carga de página.
export const listDashboardInsights = cache(async (orgSlug: string): Promise<DashboardInsight[]> => {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('dashboard_insights')
    .select('id, kind, icon, text, deep_link, score, created_at')
    .eq('organization_id', org.id)
    .is('dismissed_at', null)
    .order('score', { ascending: false })
    .limit(6)
  return (data as DashboardInsight[] | null) || []
})

export async function dismissInsight(orgSlug: string, id: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { error } = await supabase
    .from('dashboard_insights')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}`)
  return { ok: true as const }
}

/**
 * Botão "Gerar Insights" na Inicial — recálculo sob demanda. Substitui a
 * cron Inngest que rodava a cada 4h pra toda org incondicionalmente (ver
 * lib/dashboard/insights-detectors.ts). Server Action comum, não passa
 * pelo Inngest.
 */
export async function generateInsightsNow(orgSlug: string) {
  const org = await getCurrentOrganization(orgSlug)
  const admin = createAdminClient()
  try {
    const count = await generateInsightsForOrg(admin, org.id)
    revalidatePath(`/app/${orgSlug}`)
    return { ok: true as const, count }
  } catch (e: any) {
    return { ok: false as const, error: e?.message || 'Falha ao gerar insights.' }
  }
}
