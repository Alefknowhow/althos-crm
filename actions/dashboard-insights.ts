'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'

export type DashboardInsight = {
  id: string
  kind: 'opportunity' | 'risk' | 'info'
  icon: string | null
  text: string
  deep_link: string | null
  score: number
  created_at: string
}

export async function listDashboardInsights(orgSlug: string): Promise<DashboardInsight[]> {
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
}

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
