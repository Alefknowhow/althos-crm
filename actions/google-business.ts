'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization, isImpersonating } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'
import {
  refreshAccessToken, listGoogleBusinessLocations, listGoogleBusinessReviews,
  replyToGoogleBusinessReview, deleteGoogleBusinessReviewReply,
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

/** Unidades vinculadas (is_linked=true) de todas as contas conectadas da
 * org — alimenta o seletor de unidade na tela de Avaliações. */
export async function getLinkedGoogleBusinessLocations(orgSlug: string): Promise<GoogleBusinessLocation[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('google_business_locations')
    .select('id, connection_id, google_location_id, title, address, is_linked')
    .eq('organization_id', org.id)
    .eq('is_linked', true)
    .order('title', { ascending: true })
  return (data as GoogleBusinessLocation[]) ?? []
}

// ── Avaliações ──────────────────────────────────────────────────────────────

export type GoogleBusinessReview = {
  id: string
  location_id: string
  google_review_id: string
  reviewer_name: string | null
  reviewer_photo_url: string | null
  star_rating: number | null
  comment: string | null
  create_time: string | null
  reply_comment: string | null
  reply_update_time: string | null
}

export async function listGoogleBusinessReviewsForLocation(orgSlug: string, locationId: string): Promise<GoogleBusinessReview[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('google_business_reviews')
    .select('id, location_id, google_review_id, reviewer_name, reviewer_photo_url, star_rating, comment, create_time, reply_comment, reply_update_time')
    .eq('organization_id', org.id)
    .eq('location_id', locationId)
    .order('create_time', { ascending: false })
  return (data as GoogleBusinessReview[]) ?? []
}

/** Busca as avaliações da unidade na API do Google e sincroniza no banco
 * (upsert por google_review_id — preserva o histórico, atualiza o resto). */
export async function syncGoogleBusinessReviews(orgSlug: string, locationId: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'marketing')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  const { data: location } = await supabase
    .from('google_business_locations')
    .select('id, google_location_id, connection_id, google_business_connections(id, refresh_token, google_account_id)')
    .eq('id', locationId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!location) return { ok: false as const, error: 'Unidade não encontrada.' }
  const connection = Array.isArray(location.google_business_connections)
    ? location.google_business_connections[0]
    : location.google_business_connections
  if (!connection) return { ok: false as const, error: 'Conexão não encontrada.' }

  try {
    const { accessToken, expiresIn } = await refreshAccessToken(connection.refresh_token)
    await supabase
      .from('google_business_connections')
      .update({ access_token: accessToken, token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString() })
      .eq('id', connection.id)

    // google_location_id já vem no formato "accounts/{id}/locations/{id}"
    // (é o `name` retornado pela Business Information API), então dá pra
    // montar o path de reviews direto, sem outra chamada.
    const reviews = await listGoogleBusinessReviews(accessToken, location.google_location_id)

    for (const r of reviews) {
      await supabase.from('google_business_reviews').upsert(
        {
          organization_id: org.id,
          location_id: location.id,
          google_review_id: r.name,
          reviewer_name: r.reviewerName,
          reviewer_photo_url: r.reviewerPhotoUrl,
          star_rating: r.starRating,
          comment: r.comment,
          create_time: r.createTime,
          update_time: r.updateTime,
          reply_comment: r.replyComment,
          reply_update_time: r.replyUpdateTime,
          synced_at: new Date().toISOString(),
        },
        { onConflict: 'location_id,google_review_id' },
      )
    }

    revalidatePath(`/app/${orgSlug}/avaliacoes`)
    return { ok: true as const, count: reviews.length }
  } catch (e: any) {
    return { ok: false as const, error: e?.message || 'Erro ao sincronizar avaliações' }
  }
}

/** Publica a resposta a uma avaliação — na API do Google e no banco local. */
export async function replyToGoogleReview(orgSlug: string, reviewId: string, replyText: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'marketing')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  if (!replyText.trim()) return { ok: false as const, error: 'Escreva uma resposta.' }

  const supabase = createClient()
  const { data: review } = await supabase
    .from('google_business_reviews')
    .select('id, google_review_id, location_id, google_business_locations(connection_id, google_business_connections(id, refresh_token))')
    .eq('id', reviewId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!review) return { ok: false as const, error: 'Avaliação não encontrada.' }
  const location = Array.isArray(review.google_business_locations) ? review.google_business_locations[0] : review.google_business_locations
  const connection = location && (Array.isArray((location as any).google_business_connections) ? (location as any).google_business_connections[0] : (location as any).google_business_connections)
  if (!connection) return { ok: false as const, error: 'Conexão não encontrada.' }

  try {
    const { accessToken, expiresIn } = await refreshAccessToken(connection.refresh_token)
    await supabase
      .from('google_business_connections')
      .update({ access_token: accessToken, token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString() })
      .eq('id', connection.id)

    await replyToGoogleBusinessReview(accessToken, review.google_review_id, replyText.trim())

    await supabase
      .from('google_business_reviews')
      .update({ reply_comment: replyText.trim(), reply_update_time: new Date().toISOString() })
      .eq('id', reviewId)

    revalidatePath(`/app/${orgSlug}/avaliacoes`)
    return { ok: true as const }
  } catch (e: any) {
    return { ok: false as const, error: e?.message || 'Erro ao responder avaliação' }
  }
}

/** Remove a resposta publicada — na API do Google e no banco local. */
export async function deleteGoogleReviewReply(orgSlug: string, reviewId: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'marketing')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  const { data: review } = await supabase
    .from('google_business_reviews')
    .select('id, google_review_id, google_business_locations(connection_id, google_business_connections(id, refresh_token))')
    .eq('id', reviewId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!review) return { ok: false as const, error: 'Avaliação não encontrada.' }
  const location = Array.isArray(review.google_business_locations) ? review.google_business_locations[0] : review.google_business_locations
  const connection = location && (Array.isArray((location as any).google_business_connections) ? (location as any).google_business_connections[0] : (location as any).google_business_connections)
  if (!connection) return { ok: false as const, error: 'Conexão não encontrada.' }

  try {
    const { accessToken, expiresIn } = await refreshAccessToken(connection.refresh_token)
    await supabase
      .from('google_business_connections')
      .update({ access_token: accessToken, token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString() })
      .eq('id', connection.id)

    await deleteGoogleBusinessReviewReply(accessToken, review.google_review_id)

    await supabase
      .from('google_business_reviews')
      .update({ reply_comment: null, reply_update_time: null })
      .eq('id', reviewId)

    revalidatePath(`/app/${orgSlug}/avaliacoes`)
    return { ok: true as const }
  } catch (e: any) {
    return { ok: false as const, error: e?.message || 'Erro ao remover resposta' }
  }
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
