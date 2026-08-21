'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'

/**
 * Match Lead × Imóvel (Vertical Imobiliárias, Fase 2) — ver
 * supabase/migrations/0179_real_estate_interests_visits.sql. Mostrado
 * tanto no detalhe do contato ("Imóveis de interesse") quanto no detalhe
 * do imóvel ("Leads interessados") — mesma tabela, dois pontos de leitura.
 */

export type PropertyInterestRow = {
  id: string
  property_id: string
  contato_id: string
  is_favorite: boolean
  notes: string | null
  created_at: string
  property_title: string | null
  property_code: string | null
  contato_name: string | null
}

async function requireAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'imoveis')
  if (!check.allowed) throw new Error(check.reason || 'Sem permissão')
  return { org, user }
}

export async function listInterestsByContato(orgSlug: string, contatoId: string): Promise<PropertyInterestRow[]> {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('property_interests')
    .select('id, property_id, contato_id, is_favorite, notes, created_at, properties(title, code)')
    .eq('organization_id', org.id)
    .eq('contato_id', contatoId)
    .order('is_favorite', { ascending: false })
    .order('created_at', { ascending: false })
  return (data || []).map((r: any) => ({
    id: r.id, property_id: r.property_id, contato_id: r.contato_id, is_favorite: r.is_favorite,
    notes: r.notes, created_at: r.created_at,
    property_title: r.properties?.title ?? null, property_code: r.properties?.code ?? null, contato_name: null,
  }))
}

export async function listInterestsByProperty(orgSlug: string, propertyId: string): Promise<PropertyInterestRow[]> {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('property_interests')
    .select('id, property_id, contato_id, is_favorite, notes, created_at, contatos(name)')
    .eq('organization_id', org.id)
    .eq('property_id', propertyId)
    .order('is_favorite', { ascending: false })
    .order('created_at', { ascending: false })
  return (data || []).map((r: any) => ({
    id: r.id, property_id: r.property_id, contato_id: r.contato_id, is_favorite: r.is_favorite,
    notes: r.notes, created_at: r.created_at,
    property_title: null, property_code: null, contato_name: r.contatos?.name ?? null,
  }))
}

export async function addInterest(orgSlug: string, input: { propertyId: string; contatoId: string; notes?: string | null }) {
  const { org, user } = await requireAccess(orgSlug)
  const supabase = createClient()
  const { error } = await supabase
    .from('property_interests')
    .insert({ organization_id: org.id, property_id: input.propertyId, contato_id: input.contatoId, notes: input.notes ?? null, created_by: user.id })
  if (error) {
    if (error.code === '23505') return { ok: false as const, error: 'Esse lead já está marcado como interessado nesse imóvel.' }
    return { ok: false as const, error: error.message }
  }
  revalidatePath(`/app/${orgSlug}/imoveis/${input.propertyId}`)
  revalidatePath(`/app/${orgSlug}/contatos`)
  return { ok: true as const }
}

export async function removeInterest(orgSlug: string, id: string) {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()
  const { error } = await supabase.from('property_interests').delete().eq('id', id).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}

export async function toggleFavorite(orgSlug: string, id: string, isFavorite: boolean) {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()
  const { error } = await supabase.from('property_interests').update({ is_favorite: isFavorite }).eq('id', id).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}
