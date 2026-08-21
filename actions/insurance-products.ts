'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'

/**
 * Produtos de Seguro (Vertical Seguros, Fase 1) — ver
 * supabase/migrations/0185_insurance_catalog.sql. Catálogo extensível
 * (Auto/Residencial/Vida/etc.) sem enum travado, mesmo espírito de
 * `properties.property_type` na vertical Imobiliárias.
 */

export type InsuranceProductRow = {
  id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

const ProductSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
})

async function requireAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'seguros')
  if (!check.allowed) throw new Error(check.reason || 'Sem permissão')
  return { org, user }
}

export async function listInsuranceProducts(orgSlug: string): Promise<InsuranceProductRow[]> {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('insurance_products')
    .select('id, name, description, is_active, created_at, updated_at')
    .eq('organization_id', org.id)
    .order('name')
  return data || []
}

export async function createInsuranceProduct(orgSlug: string, input: unknown) {
  const { org, user } = await requireAccess(orgSlug)
  const parsed = ProductSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'Dados inválidos: ' + parsed.error.issues[0]?.message }
  const v = parsed.data

  const supabase = createClient()
  const { error } = await supabase.from('insurance_products').insert({
    organization_id: org.id, name: v.name, description: v.description ?? null,
    is_active: v.isActive ?? true, created_by: user.id,
  })
  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/produtos-seguro`)
  return { ok: true as const }
}

export async function updateInsuranceProduct(orgSlug: string, id: string, input: unknown) {
  const { org } = await requireAccess(orgSlug)
  const parsed = ProductSchema.partial().safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'Dados inválidos: ' + parsed.error.issues[0]?.message }
  const v = parsed.data

  const patch: Record<string, unknown> = {}
  if (v.name !== undefined) patch.name = v.name
  if (v.description !== undefined) patch.description = v.description
  if (v.isActive !== undefined) patch.is_active = v.isActive

  const supabase = createClient()
  const { error } = await supabase.from('insurance_products').update(patch).eq('id', id).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/produtos-seguro`)
  return { ok: true as const }
}

export async function archiveInsuranceProduct(orgSlug: string, id: string) {
  return updateInsuranceProduct(orgSlug, id, { isActive: false })
}
