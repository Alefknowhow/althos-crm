'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'

/**
 * Cadastro de imóveis (Vertical Imobiliárias, Fase 1) — ver
 * supabase/migrations/0178_real_estate_properties.sql. Mesma arquitetura
 * das demais verticais: entidade própria + reaproveitamento de Contatos
 * (proprietário) e membros da org (corretor responsável).
 */

export type PropertyRow = {
  id: string
  organization_id: string
  code: string | null
  title: string
  property_type: string | null
  purpose: 'venda' | 'locacao' | 'venda_locacao'
  status: 'disponivel' | 'reservado' | 'em_negociacao' | 'vendido' | 'alugado' | 'indisponivel'
  price_cents: number | null
  condo_fee_cents: number | null
  iptu_cents: number | null
  address_street: string | null
  address_number: string | null
  address_complement: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  zip: string | null
  lat: number | null
  lng: number | null
  bedrooms: number | null
  suites: number | null
  bathrooms: number | null
  parking_spots: number | null
  area_built: number | null
  area_total: number | null
  area_useful: number | null
  floor: string | null
  rooms_count: number | null
  features: string[]
  description_html: string | null
  owner_contato_id: string | null
  broker_user_id: string | null
  capture_source: string | null
  is_exclusive: boolean
  exclusivity_until: string | null
  commission_percent: number | null
  internal_notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type PropertyMediaRow = {
  id: string
  property_id: string
  storage_key: string
  media_type: 'photo' | 'video' | 'document'
  label: string | null
  sort_order: number
  is_cover: boolean
}

const PropertySchema = z.object({
  title: z.string().max(200).optional(),
  property_type: z.string().max(80).nullable().optional(),
  purpose: z.enum(['venda', 'locacao', 'venda_locacao']).optional(),
  status: z.enum(['disponivel', 'reservado', 'em_negociacao', 'vendido', 'alugado', 'indisponivel']).optional(),
  price_cents: z.number().int().min(0).nullable().optional(),
  condo_fee_cents: z.number().int().min(0).nullable().optional(),
  iptu_cents: z.number().int().min(0).nullable().optional(),
  address_street: z.string().max(200).nullable().optional(),
  address_number: z.string().max(20).nullable().optional(),
  address_complement: z.string().max(120).nullable().optional(),
  neighborhood: z.string().max(120).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  state: z.string().max(2).nullable().optional(),
  zip: z.string().max(20).nullable().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  bedrooms: z.number().int().min(0).nullable().optional(),
  suites: z.number().int().min(0).nullable().optional(),
  bathrooms: z.number().int().min(0).nullable().optional(),
  parking_spots: z.number().int().min(0).nullable().optional(),
  area_built: z.number().min(0).nullable().optional(),
  area_total: z.number().min(0).nullable().optional(),
  area_useful: z.number().min(0).nullable().optional(),
  floor: z.string().max(20).nullable().optional(),
  rooms_count: z.number().int().min(0).nullable().optional(),
  features: z.array(z.string().max(60)).max(40).optional(),
  description_html: z.string().max(20000).nullable().optional(),
  owner_contato_id: z.string().uuid().nullable().optional(),
  broker_user_id: z.string().uuid().nullable().optional(),
  capture_source: z.string().max(120).nullable().optional(),
  is_exclusive: z.boolean().optional(),
  exclusivity_until: z.string().nullable().optional(),
  commission_percent: z.number().min(0).max(100).nullable().optional(),
  internal_notes: z.string().max(4000).nullable().optional(),
})

export type PropertyFilters = {
  q?: string
  status?: string
  purpose?: string
  property_type?: string
  city?: string
  neighborhood?: string
  price_min_cents?: number
  price_max_cents?: number
  bedrooms?: number
  parking_spots?: number
  broker_user_id?: string
  owner_contato_id?: string
}

export async function listProperties(orgSlug: string, filters: PropertyFilters = {}): Promise<PropertyRow[]> {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'imoveis')
  if (!perm.allowed) return []

  const supabase = createClient()
  let query = supabase.from('properties').select('*').eq('organization_id', org.id)

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.purpose) query = query.eq('purpose', filters.purpose)
  if (filters.property_type) query = query.eq('property_type', filters.property_type)
  if (filters.city) query = query.ilike('city', `%${filters.city}%`)
  if (filters.neighborhood) query = query.ilike('neighborhood', `%${filters.neighborhood}%`)
  if (filters.price_min_cents != null) query = query.gte('price_cents', filters.price_min_cents)
  if (filters.price_max_cents != null) query = query.lte('price_cents', filters.price_max_cents)
  if (filters.bedrooms != null) query = query.gte('bedrooms', filters.bedrooms)
  if (filters.parking_spots != null) query = query.gte('parking_spots', filters.parking_spots)
  if (filters.broker_user_id) query = query.eq('broker_user_id', filters.broker_user_id)
  if (filters.owner_contato_id) query = query.eq('owner_contato_id', filters.owner_contato_id)
  if (filters.q?.trim()) {
    const q = filters.q.trim()
    query = query.or(`title.ilike.%${q}%,code.ilike.%${q}%,address_street.ilike.%${q}%,neighborhood.ilike.%${q}%`)
  }

  const { data } = await query.order('updated_at', { ascending: false }).limit(500)
  return (data as PropertyRow[]) ?? []
}

export async function getProperty(orgSlug: string, id: string): Promise<{ property: PropertyRow; media: PropertyMediaRow[] } | null> {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'imoveis')
  if (!perm.allowed) return null

  const supabase = createClient()
  const [{ data: property }, { data: media }] = await Promise.all([
    supabase.from('properties').select('*').eq('id', id).eq('organization_id', org.id).maybeSingle(),
    supabase.from('property_media').select('*').eq('property_id', id).eq('organization_id', org.id).order('sort_order'),
  ])
  if (!property) return null
  return { property: property as PropertyRow, media: (media as PropertyMediaRow[]) ?? [] }
}

export async function createProperty(orgSlug: string, input: unknown = {}) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'imoveis')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const parsed = PropertySchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'Dados inválidos: ' + parsed.error.issues[0]?.message }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('properties')
    .insert({ ...parsed.data, organization_id: org.id, created_by: user.id, title: parsed.data.title || 'Novo imóvel' })
    .select('id')
    .single()
  if (error || !data) return { ok: false as const, error: error?.message || 'Erro ao criar imóvel' }

  revalidatePath(`/app/${orgSlug}/imoveis`)
  return { ok: true as const, id: data.id as string }
}

export async function updateProperty(orgSlug: string, id: string, input: unknown) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'imoveis')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const parsed = PropertySchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'Dados inválidos: ' + parsed.error.issues[0]?.message }

  const supabase = createClient()
  const { error } = await supabase
    .from('properties')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/imoveis`)
  revalidatePath(`/app/${orgSlug}/imoveis/${id}`)
  return { ok: true as const }
}

/** Soft-delete — o imóvel fica indisponível mas o histórico permanece
 *  (mídia inclusa). Delete definitivo não existe na Fase 1: sem entidade
 *  de negociação ainda, não há "só pode apagar se nunca teve negócio" pra
 *  verificar — mais seguro nunca apagar de vez por padrão. */
export async function archiveProperty(orgSlug: string, id: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'imoveis')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  const { error } = await supabase
    .from('properties')
    .update({ status: 'indisponivel', updated_at: new Date().toISOString() })
    .eq('id', id).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/imoveis`)
  return { ok: true as const }
}

export async function deleteProperty(orgSlug: string, id: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'imoveis')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  const { error } = await supabase.from('properties').delete().eq('id', id).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/imoveis`)
  return { ok: true as const }
}

/* ─────────── mídia (fotos/vídeos/documentos) ─────────── */

export async function addPropertyMedia(
  orgSlug: string, propertyId: string,
  items: { storage_key: string; media_type: 'photo' | 'video' | 'document'; label?: string | null }[],
) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'imoveis')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  if (items.length === 0) return { ok: true as const }

  const supabase = createClient()
  const { count } = await supabase
    .from('property_media').select('id', { count: 'exact', head: true })
    .eq('property_id', propertyId).eq('organization_id', org.id)
  let nextOrder = count ?? 0

  const { error } = await supabase.from('property_media').insert(
    items.map(it => ({
      organization_id: org.id, property_id: propertyId,
      storage_key: it.storage_key, media_type: it.media_type, label: it.label ?? null,
      sort_order: nextOrder++,
    })),
  )
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/imoveis/${propertyId}`)
  return { ok: true as const }
}

export async function removePropertyMedia(orgSlug: string, mediaId: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'imoveis')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  const { error } = await supabase.from('property_media').delete().eq('id', mediaId).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}

export async function reorderPropertyMedia(orgSlug: string, orderedIds: string[]) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'imoveis')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  await Promise.all(orderedIds.map((id, i) =>
    supabase.from('property_media').update({ sort_order: i }).eq('id', id).eq('organization_id', org.id),
  ))
  return { ok: true as const }
}

export async function setCoverMedia(orgSlug: string, propertyId: string, mediaId: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'imoveis')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  await supabase.from('property_media').update({ is_cover: false }).eq('property_id', propertyId).eq('organization_id', org.id)
  const { error } = await supabase.from('property_media').update({ is_cover: true }).eq('id', mediaId).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/imoveis/${propertyId}`)
  return { ok: true as const }
}
