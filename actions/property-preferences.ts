'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'

/**
 * Preferências de imóvel do lead (Vertical Imobiliárias, Fase 4) — ver
 * supabase/migrations/0181_real_estate_preferences.sql. Preenchidas
 * manualmente pelo corretor no detalhe do contato, usadas como
 * pré-filtro/contexto pro matching por IA (actions/property-matching.ts).
 */

export type PropertyPreferences = {
  purpose?: 'venda' | 'locacao' | 'qualquer'
  priceMin?: number | null
  priceMax?: number | null
  bedroomsMin?: number | null
  city?: string | null
  neighborhood?: string | null
  propertyType?: string | null
  notes?: string | null
}

const PreferencesSchema = z.object({
  purpose: z.enum(['venda', 'locacao', 'qualquer']).optional(),
  priceMin: z.number().int().min(0).nullable().optional(),
  priceMax: z.number().int().min(0).nullable().optional(),
  bedroomsMin: z.number().int().min(0).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  neighborhood: z.string().max(120).nullable().optional(),
  propertyType: z.string().max(80).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
})

async function requireAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'imoveis')
  if (!check.allowed) throw new Error(check.reason || 'Sem permissão')
  return { org, user }
}

export async function getPropertyPreferences(orgSlug: string, contatoId: string): Promise<PropertyPreferences | null> {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('contatos')
    .select('property_preferences')
    .eq('id', contatoId).eq('organization_id', org.id)
    .maybeSingle()
  return (data?.property_preferences as PropertyPreferences | null) ?? null
}

export async function savePropertyPreferences(orgSlug: string, contatoId: string, input: unknown) {
  const { org } = await requireAccess(orgSlug)
  const parsed = PreferencesSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'Dados inválidos: ' + parsed.error.issues[0]?.message }

  const supabase = createClient()
  const { error } = await supabase
    .from('contatos')
    .update({ property_preferences: parsed.data })
    .eq('id', contatoId).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/contatos`)
  return { ok: true as const }
}
