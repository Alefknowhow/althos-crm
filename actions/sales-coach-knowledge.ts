'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { checkFeatureAccessByOrgSlug } from '@/lib/plans/server'
import { checkMemberPermission, isOrgManager } from '@/lib/permissions.server'
import { emptySalesCoachKnowledge, type SalesCoachKnowledge, type SalesObjection } from '@/lib/sales-coach/knowledge'

function rowToKnowledge(row: {
  company_pitch: string
  products: string
  differentiators: string
  competitors: string
  objections: SalesObjection[]
} | null): SalesCoachKnowledge {
  if (!row) return emptySalesCoachKnowledge()
  return {
    companyPitch: row.company_pitch ?? '',
    products: row.products ?? '',
    differentiators: row.differentiators ?? '',
    competitors: row.competitors ?? '',
    objections: Array.isArray(row.objections) ? row.objections : [],
  }
}

export async function getSalesCoachKnowledge(orgSlug: string) {
  const org = await getCurrentOrganization(orgSlug)
  const allowed = await checkFeatureAccessByOrgSlug(orgSlug, 'sales_coach')
  if (!allowed) return { ok: false as const, error: 'IA Sales Coach não está disponível no plano atual.', knowledge: null }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('sales_coach_knowledge')
    .select('company_pitch, products, differentiators, competitors, objections')
    .eq('organization_id', org.id)
    .maybeSingle()

  if (error) return { ok: false as const, error: error.message, knowledge: null }
  return { ok: true as const, knowledge: rowToKnowledge(data) }
}

export async function saveSalesCoachKnowledge(orgSlug: string, knowledge: SalesCoachKnowledge) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const allowed = await checkFeatureAccessByOrgSlug(orgSlug, 'sales_coach')
  if (!allowed) return { ok: false as const, error: 'IA Sales Coach não está disponível no plano atual.' }

  const check = await checkMemberPermission(org.id, user.id, 'sales_coach')
  if (!check.allowed) return { ok: false as const, error: check.reason }
  if (!(await isOrgManager(org.id, user.id))) {
    return { ok: false as const, error: 'Apenas administradores podem alterar o contexto do IA Sales Coach.' }
  }

  const objections: SalesObjection[] = (knowledge.objections || [])
    .map((o) => ({
      id: o.id || crypto.randomUUID(),
      name: (o.name || '').trim(),
      category: (o.category || '').trim(),
      description: (o.description || '').trim(),
      recommendedStrategy: (o.recommendedStrategy || '').trim(),
    }))
    .filter((o) => o.name.length > 0)

  const admin = createAdminClient()
  const { error } = await admin.from('sales_coach_knowledge').upsert(
    {
      organization_id: org.id,
      company_pitch: (knowledge.companyPitch || '').trim(),
      products: (knowledge.products || '').trim(),
      differentiators: (knowledge.differentiators || '').trim(),
      competitors: (knowledge.competitors || '').trim(),
      objections,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'organization_id' },
  )

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/sales-coach/configuracoes`)
  return { ok: true as const }
}
