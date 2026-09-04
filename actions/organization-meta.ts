'use server'

/**
 * Meta/Facebook integration config and org deletion. Split out of
 * actions/organization.ts.
 */

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'

// ─── Meta / Facebook integration ─────────────────────────────────────────────

export async function getOrgMetaConfig(orgSlug: string) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data } = await supabase
    .from('organizations')
    .select('meta_pixel_id, meta_access_token')
    .eq('id', org.id)
    .maybeSingle()

  return {
    meta_pixel_id:     data?.meta_pixel_id     ?? '',
    // Never expose the token to the client — return only whether it's set
    has_access_token:  !!data?.meta_access_token,
  }
}

export async function saveOrgMetaConfig(
  orgSlug: string,
  values: { meta_pixel_id: string; meta_access_token?: string },
) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const update: any = { meta_pixel_id: values.meta_pixel_id || null }
  // Only overwrite the token if a new value was supplied (empty = keep existing)
  if (values.meta_access_token !== undefined && values.meta_access_token !== '') {
    update.meta_access_token = values.meta_access_token
  }

  const { error } = await supabase
    .from('organizations')
    .update(update)
    .eq('id', org.id)

  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/configuracoes/meta`)
  return { ok: true as const }
}

/**
 * Permanently delete an organization and all its data (cascades via FK).
 * Only an owner/admin member may do this. Refuses to delete the user's last
 * organization so they're never left without a workspace to land on.
 */
export async function deleteOrganization(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const admin = createAdminClient()

  // Authorize: caller must be owner/admin of THIS org.
  const { data: membership } = await admin
    .from('memberships')
    .select('role')
    .eq('organization_id', org.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return { ok: false as const, error: 'Apenas o proprietário pode excluir a organização.' }
  }

  // Refuse to delete the user's last remaining organization.
  const { data: myOrgs } = await admin
    .from('memberships')
    .select('organization_id')
    .eq('user_id', user.id)
  const remaining = (myOrgs ?? []).filter(m => m.organization_id !== org.id)
  if (remaining.length === 0) {
    return {
      ok: false as const,
      error: 'Não é possível excluir sua única organização. Crie outra antes.',
    }
  }

  const { error } = await admin.from('organizations').delete().eq('id', org.id)
  if (error) {
    console.error('deleteOrganization error:', error)
    return { ok: false as const, error: error.message }
  }

  // Pick another org for the user to land on.
  const { data: next } = await admin
    .from('organizations')
    .select('slug')
    .eq('id', remaining[0].organization_id)
    .maybeSingle()

  revalidatePath('/app')
  return { ok: true as const, nextSlug: next?.slug ?? null }
}
