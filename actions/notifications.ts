'use server'

/**
 * Per-user notification preferences.
 *
 *   getNotificationPrefs    — read the current user's prefs for an org (merged
 *                             with defaults so every category has a boolean).
 *   updateNotificationPrefs — persist a full prefs object for the current user.
 *
 * Server-only gating helpers (used by the push dispatcher, admin client):
 *   isNotificationEnabled   — single user + category check.
 *   filterUsersByCategory   — given a set of users, keep only those opted-in.
 *
 * Opt-out model: a category is ON unless the user explicitly stored `false`.
 */

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'
import {
  ALL_NOTIFICATION_CATEGORIES,
  withDefaults,
  isCategoryEnabled,
  type NotificationCategory,
  type NotificationPrefs,
} from '@/lib/notifications/categories'

// ---------------------------------------------------------------------------
// Read (current user)
// ---------------------------------------------------------------------------

export async function getNotificationPrefs(orgSlug: string): Promise<NotificationPrefs> {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data } = await supabase
    .from('notification_prefs')
    .select('prefs')
    .eq('user_id', user.id)
    .eq('organization_id', org.id)
    .maybeSingle()

  return withDefaults((data?.prefs as NotificationPrefs) ?? null)
}

// ---------------------------------------------------------------------------
// Write (current user)
// ---------------------------------------------------------------------------

export async function updateNotificationPrefs(
  orgSlug: string,
  input: Record<string, boolean>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  // Sanitise: only keep known categories, coerce to boolean.
  const prefs: NotificationPrefs = {}
  for (const cat of ALL_NOTIFICATION_CATEGORIES) {
    prefs[cat] = input[cat] !== false
  }

  const { error } = await supabase
    .from('notification_prefs')
    .upsert(
      {
        user_id: user.id,
        organization_id: org.id,
        prefs,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,organization_id' },
    )

  if (error) return { ok: false, error: error.message || 'Não foi possível salvar.' }

  revalidatePath(`/app/${orgSlug}/configuracoes/notificacoes`)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Server-side gating helpers (admin client — read other users' prefs)
// ---------------------------------------------------------------------------

/**
 * Whether `userId` wants notifications for `category` in `orgId`. Defaults to
 * true when no row/override exists (opt-out model). Never throws — on any error
 * it fails OPEN (returns true) so a prefs outage doesn't silence notifications.
 */
export async function isNotificationEnabled(
  userId: string,
  orgId: string,
  category: NotificationCategory,
): Promise<boolean> {
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('notification_prefs')
      .select('prefs')
      .eq('user_id', userId)
      .eq('organization_id', orgId)
      .maybeSingle()
    return isCategoryEnabled((data?.prefs as NotificationPrefs) ?? null, category)
  } catch {
    return true
  }
}

/**
 * Filter a list of user-ids down to those opted-in to `category` in `orgId`.
 * One query for the whole set. Fails OPEN (returns the input) on error.
 */
export async function filterUsersByCategory(
  userIds: string[],
  orgId: string,
  category: NotificationCategory,
): Promise<string[]> {
  const unique = Array.from(new Set(userIds.filter(Boolean)))
  if (unique.length === 0) return []
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('notification_prefs')
      .select('user_id, prefs')
      .eq('organization_id', orgId)
      .in('user_id', unique)

    const byUser = new Map<string, NotificationPrefs>()
    for (const row of data || []) {
      byUser.set(row.user_id as string, (row.prefs as NotificationPrefs) ?? {})
    }
    // No row → defaults to enabled.
    return unique.filter(id => isCategoryEnabled(byUser.get(id) ?? null, category))
  } catch {
    return unique
  }
}
