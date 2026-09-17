'use server'

/**
 * "Método da Agência" (spec do módulo Clientes/Tráfego, § 10) — protocolo
 * reutilizável entre todos os clientes da organização (não por cliente),
 * usado como contexto pelo Marketing Strategist (IA) junto com o perfil de
 * cada cliente. Ver actions/marketing-strategist.ts.
 */

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'

export type AgencyMethod = {
  campaignStructureRules?: string | null
  testingCriteria?: string | null
  minCreativeVariations?: number | null
  funnelDistributionNotes?: string | null
  optimizationCriteria?: string | null
  pauseCriteria?: string | null
  bestPractices?: string | null
}

const AgencyMethodSchema = z.object({
  campaignStructureRules: z.string().max(3000).nullable().optional(),
  testingCriteria: z.string().max(3000).nullable().optional(),
  minCreativeVariations: z.number().int().min(0).nullable().optional(),
  funnelDistributionNotes: z.string().max(3000).nullable().optional(),
  optimizationCriteria: z.string().max(3000).nullable().optional(),
  pauseCriteria: z.string().max(3000).nullable().optional(),
  bestPractices: z.string().max(3000).nullable().optional(),
})

async function requireAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'trafego')
  if (!check.allowed) throw new Error(check.reason || 'Sem permissão')
  return { org, user }
}

export async function getAgencyMethod(orgSlug: string): Promise<AgencyMethod | null> {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()
  const { data } = await supabase.from('organizations').select('trafego_agency_method').eq('id', org.id).maybeSingle()
  return (data?.trafego_agency_method as AgencyMethod | null) ?? null
}

export async function saveAgencyMethod(orgSlug: string, input: unknown) {
  const { org } = await requireAccess(orgSlug)
  const parsed = AgencyMethodSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'Dados inválidos: ' + parsed.error.issues[0]?.message }

  const supabase = createClient()
  const { error } = await supabase.from('organizations').update({ trafego_agency_method: parsed.data }).eq('id', org.id)
  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/agencias-trafego/trafego`)
  return { ok: true as const }
}
