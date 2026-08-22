'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'

/**
 * Perfil de gestão do cliente de tráfego (Vertical Agências de Tráfego —
 * correção pós-teste) — ver supabase/migrations/0190_traffic_client_management.sql.
 * Preenchido manualmente pelo gestor no detalhe do contato, mesmo padrão
 * de actions/property-preferences.ts.
 */

export type TrafficClientProfile = {
  niche?: string | null
  objective?: 'leads' | 'vendas' | 'reconhecimento' | 'trafego_site' | 'outro'
  monthlyBudgetCents?: number | null
  targetAudience?: string | null
  rules?: string | null
  referenceLinks?: string | null
  contractStart?: string | null
  notes?: string | null
}

const ProfileSchema = z.object({
  niche: z.string().max(120).nullable().optional(),
  objective: z.enum(['leads', 'vendas', 'reconhecimento', 'trafego_site', 'outro']).optional(),
  monthlyBudgetCents: z.number().int().min(0).nullable().optional(),
  targetAudience: z.string().max(1000).nullable().optional(),
  rules: z.string().max(2000).nullable().optional(),
  referenceLinks: z.string().max(2000).nullable().optional(),
  contractStart: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

async function requireAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'trafego')
  if (!check.allowed) throw new Error(check.reason || 'Sem permissão')
  return { org, user }
}

export async function getTrafficClientProfile(orgSlug: string, contatoId: string): Promise<TrafficClientProfile | null> {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('contatos')
    .select('traffic_client_profile')
    .eq('id', contatoId).eq('organization_id', org.id)
    .maybeSingle()
  return (data?.traffic_client_profile as TrafficClientProfile | null) ?? null
}

export async function saveTrafficClientProfile(orgSlug: string, contatoId: string, input: unknown) {
  const { org } = await requireAccess(orgSlug)
  const parsed = ProfileSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'Dados inválidos: ' + parsed.error.issues[0]?.message }

  const supabase = createClient()
  const { error } = await supabase
    .from('contatos')
    .update({ traffic_client_profile: parsed.data })
    .eq('id', contatoId).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/contatos`)
  return { ok: true as const }
}
