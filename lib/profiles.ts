import { createAdminClient } from '@/lib/supabase/server'

export interface ProfileLite {
  email: string
  /** Display name from auth metadata (name || full_name), may be empty. */
  full_name: string
}

/**
 * Batch-resolve display info (email + name) for a set of user ids via the
 * `public.profiles` mirror table — ONE query instead of N admin.getUserById()
 * round-trips. `profiles.full_name` already coalesces the auth metadata
 * `name`/`full_name`. Reads through the service-role client (profiles has RLS
 * on with no public policy, so it is server-only).
 */
export async function getProfilesMap(
  ids: (string | null | undefined)[],
): Promise<Map<string, ProfileLite>> {
  const unique = Array.from(new Set(ids.filter((x): x is string => !!x)))
  const map = new Map<string, ProfileLite>()
  if (unique.length === 0) return map

  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('id, email, full_name')
    .in('id', unique)

  for (const p of data ?? []) {
    map.set(p.id as string, {
      email: (p.email as string) ?? '',
      full_name: (p.full_name as string) ?? '',
    })
  }
  return map
}
