'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization, isImpersonating } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'
import {
  refreshAccessToken, listGoogleBusinessLocations,
} from '@/lib/google-business/oauth'

export type GoogleBusinessConnection = {
  id: string
  google_account_id: string
  account_name: string | null
  is_active: boolean
  created_at: string
}

export type GoogleBusinessLocation = {
  id: string
  connection_id: string
  google_location_id: string
  title: string | null
  address: string | null
  is_linked: boolean
}

export async function getGoogleBusinessConnections(orgSlug: string): Promise<GoogleBusinessConnection[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('google_business_connections')
    .select('id, google_account_id, account_name, is_active, created_at')
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })
  return (data as GoogleBusinessConnection[]) ?? []
}

export async function getGoogleBusinessLocations(orgSlug: string, connectionId: string): Promise<GoogleBusinessLocation[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('google_business_locations')
    .select('id, connection_id, google_location_id, title, address, is_linked')
    .eq('organization_id', org.id)
    .eq('connection_id', connectionId)
    .order('title', { ascending: true })
  return (data as GoogleBusinessLocation[]) ?? []
}

/**
 * Calls the Business Information API to (re)fetch the locations under a
 * connection's Google account, refreshing the access token first, and
 * upserts them into google_business_locations (is_linked defaults to false
 * for new rows — the user picks which ones to activate).
 */
export async function syncGoogleBusinessLocations(orgSlug: string, connectionId: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'settings')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  const { data: conn } = await supabase
    .from('google_business_connections')
    .select('id, google_account_id, refresh_token')
    .eq('id', connectionId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!conn) return { ok: false as const, error: 'Conexão não encontrada.' }

  try {
    const { accessToken, expiresIn } = await refreshAccessToken(conn.refresh_token)
    await supabase
      .from('google_business_connections')
      .update({ access_token: accessToken, token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString() })
      .eq('id', connectionId)

    const locations = await listGoogleBusinessLocations(accessToken, conn.google_account_id)

    for (const loc of locations) {
      await supabase
        .from('google_business_locations')
        .upsert(
          {
            connection_id: connectionId,
            organization_id: org.id,
            google_location_id: loc.name,
            title: loc.title,
            address: loc.address,
          },
          { onConflict: 'connection_id,google_location_id', ignoreDuplicates: false },
        )
    }

    revalidatePath(`/app/${orgSlug}/configuracoes/google-business`)
    return { ok: true as const, count: locations.length }
  } catch (e: any) {
    return { ok: false as const, error: e?.message || 'Erro ao sincronizar unidades' }
  }
}

export async function toggleGoogleBusinessLocationLink(orgSlug: string, locationId: string, linked: boolean) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'settings')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  const { error } = await supabase
    .from('google_business_locations')
    .update({ is_linked: linked })
    .eq('id', locationId)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/configuracoes/google-business`)
  return { ok: true as const }
}

export async function deleteGoogleBusinessConnection(orgSlug: string, id: string) {
  if (isImpersonating()) {
    return { ok: false as const, error: 'Ações destrutivas não são permitidas em modo de impersonação.' }
  }
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'settings')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  const { error } = await supabase
    .from('google_business_connections')
    .delete()
    .eq('id', id)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/configuracoes/google-business`)
  return { ok: true as const }
}
