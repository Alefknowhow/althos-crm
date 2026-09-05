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
  /** @deprecated texto livre antigo — mantido só por compatibilidade com registros já salvos. Regras novas vão em `optimizationRules`. */
  rules?: string | null
  referenceLinks?: string | null
  contractStart?: string | null
  notes?: string | null
  /** Metas — usadas por get_client_targets (Etapa 3, Agent Layer) pra
   *  comparar resultado real vs. meta configurada pelo gestor. */
  targetRoas?: number | null
  targetCpl?: number | null
  targetLeads?: number | null
  targetRevenueCents?: number | null
  targetCpaCents?: number | null
  /** Meta de conversão lead → venda (%) — quantos dos leads gerados devem
   *  virar cliente. Complementa targetCpl/targetCpaCents/targetRoas, que
   *  falam de custo/retorno mas não da taxa de conversão em si. */
  targetLeadToSalePct?: number | null
  // Empresa
  website?: string | null
  instagram?: string | null
  region?: string | null
  // Público (granular — targetAudience acima segue como visão geral em texto livre)
  audienceAgeRange?: string | null
  audienceProfile?: string | null
  audienceInterests?: string | null
  // Oferta
  product?: string | null
  avgTicketCents?: number | null
  marginPct?: number | null
  mainOffer?: string | null
  differentials?: string | null
  // Estratégia
  strategyNotes?: string | null
  // Regras de otimização — lista estruturada (não texto livre), pensada
  // pra futura leitura pelo Agent Layer antes de sugerir/aplicar uma ação.
  optimizationRules?: string[]
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
  targetRoas: z.number().min(0).nullable().optional(),
  targetCpl: z.number().min(0).nullable().optional(),
  targetLeads: z.number().int().min(0).nullable().optional(),
  targetRevenueCents: z.number().int().min(0).nullable().optional(),
  targetCpaCents: z.number().int().min(0).nullable().optional(),
  targetLeadToSalePct: z.number().min(0).max(100).nullable().optional(),
  website: z.string().max(300).nullable().optional(),
  instagram: z.string().max(150).nullable().optional(),
  region: z.string().max(200).nullable().optional(),
  audienceAgeRange: z.string().max(100).nullable().optional(),
  audienceProfile: z.string().max(500).nullable().optional(),
  audienceInterests: z.string().max(500).nullable().optional(),
  product: z.string().max(200).nullable().optional(),
  avgTicketCents: z.number().int().min(0).nullable().optional(),
  marginPct: z.number().min(0).max(100).nullable().optional(),
  mainOffer: z.string().max(500).nullable().optional(),
  differentials: z.string().max(500).nullable().optional(),
  strategyNotes: z.string().max(3000).nullable().optional(),
  optimizationRules: z.array(z.string().max(300)).max(30).optional(),
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

  await supabase.from('contato_activities').insert({
    contato_id: contatoId,
    organization_id: org.id,
    type: 'traffic_profile_updated',
    payload: {},
  })

  revalidatePath(`/app/${orgSlug}/contatos`)
  revalidatePath(`/app/${orgSlug}/agencias-trafego/trafego/${contatoId}`)
  return { ok: true as const }
}
