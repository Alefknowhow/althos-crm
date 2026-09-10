import type { PermissionKey } from '@/lib/permissions'
import { checkMemberPermission } from '@/lib/permissions.server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization,isImpersonating,requireAuth } from '@/lib/supabase/types'

/** Private dependency boundary, never exported as a Server Action. */
export type ActionContext = {
  supabase: ReturnType<typeof createClient>
  org: Awaited<ReturnType<typeof getCurrentOrganization>>
  user: { id: string }
  impersonating: boolean
  checkPermission: (keys: PermissionKey[]) => Promise<{ allowed: boolean; reason?: string }>
}

export async function getActionContext(orgSlug: string): Promise<ActionContext> {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  return {
    supabase: createClient(), org, user, impersonating: isImpersonating(),
    checkPermission: async keys => {
      const checks = await Promise.all(keys.map(key => checkMemberPermission(org.id, user.id, key)))
      return checks.find(check => check.allowed) ?? checks[0]
    },
  }
}
