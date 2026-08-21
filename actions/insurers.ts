'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'

/**
 * Seguradoras (Vertical Seguros, Fase 1) — ver
 * supabase/migrations/0185_insurance_catalog.sql. Não existia entidade
 * de seguradora/operadora no projeto (Viagens usa `operator` como texto
 * livre em travel_sales); tabela nova, RLS padrão. `logo_storage_key`
 * grava a URL retornada por uploadSaleVoucher (actions/upload.ts) — sem
 * tabela de mídia dedicada, só 1 logo por seguradora.
 */

export type InsurerRow = {
  id: string
  name: string
  cnpj: string | null
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  conditions: string | null
  logo_storage_key: string | null
  internal_notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

const InsurerSchema = z.object({
  name: z.string().min(1).max(200),
  cnpj: z.string().max(32).nullable().optional(),
  contactName: z.string().max(150).nullable().optional(),
  contactPhone: z.string().max(32).nullable().optional(),
  contactEmail: z.string().max(200).nullable().optional(),
  conditions: z.string().max(4000).nullable().optional(),
  logoStorageKey: z.string().max(1000).nullable().optional(),
  internalNotes: z.string().max(4000).nullable().optional(),
  isActive: z.boolean().optional(),
})

function mapRow(r: any): InsurerRow {
  return {
    id: r.id, name: r.name, cnpj: r.cnpj, contact_name: r.contact_name,
    contact_phone: r.contact_phone, contact_email: r.contact_email, conditions: r.conditions,
    logo_storage_key: r.logo_storage_key, internal_notes: r.internal_notes,
    is_active: r.is_active, created_at: r.created_at, updated_at: r.updated_at,
  }
}

async function requireAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'seguros')
  if (!check.allowed) throw new Error(check.reason || 'Sem permissão')
  return { org, user }
}

export async function listInsurers(orgSlug: string): Promise<InsurerRow[]> {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('insurers')
    .select('*')
    .eq('organization_id', org.id)
    .order('name')
  return (data || []).map(mapRow)
}

export async function getInsurer(orgSlug: string, id: string): Promise<InsurerRow | null> {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('insurers').select('*')
    .eq('id', id).eq('organization_id', org.id)
    .maybeSingle()
  return data ? mapRow(data) : null
}

export async function createInsurer(orgSlug: string, input: unknown) {
  const { org, user } = await requireAccess(orgSlug)
  const parsed = InsurerSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'Dados inválidos: ' + parsed.error.issues[0]?.message }
  const v = parsed.data

  const supabase = createClient()
  const { error } = await supabase.from('insurers').insert({
    organization_id: org.id, name: v.name, cnpj: v.cnpj ?? null,
    contact_name: v.contactName ?? null, contact_phone: v.contactPhone ?? null, contact_email: v.contactEmail ?? null,
    conditions: v.conditions ?? null, logo_storage_key: v.logoStorageKey ?? null,
    internal_notes: v.internalNotes ?? null, is_active: v.isActive ?? true, created_by: user.id,
  })
  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/seguradoras`)
  return { ok: true as const }
}

export async function updateInsurer(orgSlug: string, id: string, input: unknown) {
  const { org } = await requireAccess(orgSlug)
  const parsed = InsurerSchema.partial().safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'Dados inválidos: ' + parsed.error.issues[0]?.message }
  const v = parsed.data

  const patch: Record<string, unknown> = {}
  if (v.name !== undefined) patch.name = v.name
  if (v.cnpj !== undefined) patch.cnpj = v.cnpj
  if (v.contactName !== undefined) patch.contact_name = v.contactName
  if (v.contactPhone !== undefined) patch.contact_phone = v.contactPhone
  if (v.contactEmail !== undefined) patch.contact_email = v.contactEmail
  if (v.conditions !== undefined) patch.conditions = v.conditions
  if (v.logoStorageKey !== undefined) patch.logo_storage_key = v.logoStorageKey
  if (v.internalNotes !== undefined) patch.internal_notes = v.internalNotes
  if (v.isActive !== undefined) patch.is_active = v.isActive

  const supabase = createClient()
  const { error } = await supabase.from('insurers').update(patch).eq('id', id).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/seguradoras`)
  return { ok: true as const }
}

export async function archiveInsurer(orgSlug: string, id: string) {
  return updateInsurer(orgSlug, id, { isActive: false })
}
