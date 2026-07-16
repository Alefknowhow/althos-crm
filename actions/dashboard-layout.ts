'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'
import { DEFAULT_WIDGET_KEYS, WIDGET_KEYS } from '@/lib/dashboard/widget-catalog'

export type DashboardLayout = {
  widgetKeys: string[]
  pinnedCards: any[]
  periodDefault: string
}

export async function getDashboardLayout(orgSlug: string): Promise<DashboardLayout> {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data } = await supabase
    .from('dashboard_layouts')
    .select('widget_keys, pinned_cards, period_default')
    .eq('organization_id', org.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!data) {
    return { widgetKeys: DEFAULT_WIDGET_KEYS, pinnedCards: [], periodDefault: '30d' }
  }

  // Filtra chaves que não existem mais no registry (ex.: widget removido do
  // catálogo em uma atualização) sem quebrar o layout salvo do usuário.
  const widgetKeys = (data.widget_keys || []).filter((k: string) => WIDGET_KEYS.includes(k))

  return {
    widgetKeys: widgetKeys.length > 0 ? widgetKeys : DEFAULT_WIDGET_KEYS,
    pinnedCards: data.pinned_cards || [],
    periodDefault: data.period_default || '30d',
  }
}

export async function saveDashboardLayout(orgSlug: string, widgetKeys: string[]) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const cleanKeys = widgetKeys.filter(k => WIDGET_KEYS.includes(k))

  const { error } = await supabase
    .from('dashboard_layouts')
    .upsert(
      { organization_id: org.id, user_id: user.id, widget_keys: cleanKeys },
      { onConflict: 'organization_id,user_id' },
    )

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}`)
  return { ok: true as const }
}

export async function savePeriodDefault(orgSlug: string, period: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { error } = await supabase
    .from('dashboard_layouts')
    .upsert(
      { organization_id: org.id, user_id: user.id, period_default: period },
      { onConflict: 'organization_id,user_id' },
    )

  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}
