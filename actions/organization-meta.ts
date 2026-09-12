'use server'

/**
 * Org deletion. Split out of actions/organization.ts. (Meta/Facebook
 * Pixel/CAPI config used to live here too — moved to per-pipeline config,
 * see actions/pipeline-crud.ts::savePipelineMetaConfig.)
 */

import { createAdminClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'

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
