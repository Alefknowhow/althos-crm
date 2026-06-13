'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'

export type SavedFilter = {
  id: string
  name: string
  entity: string
  config: Record<string, any>
  is_shared: boolean
  user_id: string
  created_at: string
}

export async function listSavedFilters(orgSlug: string, entity: string): Promise<SavedFilter[]> {
  const supabase = createClient()
  const org = await getCurrentOrganization(orgSlug)

  const { data, error } = await supabase
    .from('saved_filters')
    .select('id, name, entity, config, is_shared, user_id, created_at')
    .eq('organization_id', org.id)
    .eq('entity', entity)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('listSavedFilters error:', error)
    return []
  }
  return (data || []) as SavedFilter[]
}

export async function createSavedFilter(
  orgSlug: string,
  payload: { name: string; entity: string; config: Record<string, any>; is_shared?: boolean },
) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const name = (payload.name || '').trim()
  if (!name) return { ok: false as const, error: 'Nome é obrigatório' }

  const { data, error } = await supabase
    .from('saved_filters')
    .insert({
      organization_id: org.id,
      user_id: user.id,
      entity: payload.entity,
      name,
      config: payload.config || {},
      is_shared: !!payload.is_shared,
    })
    .select('id, name, entity, config, is_shared, user_id, created_at')
    .maybeSingle()

  if (error || !data) {
    console.error('createSavedFilter error:', error)
    return { ok: false as const, error: error?.message || 'Erro ao salvar filtro' }
  }

  revalidatePath(`/app/${orgSlug}/contatos`)
  return { ok: true as const, filter: data as SavedFilter }
}

export async function deleteSavedFilter(orgSlug: string, id: string) {
  const supabase = createClient()
  const org = await getCurrentOrganization(orgSlug)

  const { error } = await supabase
    .from('saved_filters')
    .delete()
    .eq('id', id)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/contatos`)
  return { ok: true as const }
}
