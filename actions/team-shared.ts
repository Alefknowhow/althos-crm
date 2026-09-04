import { createAdminClient } from '@/lib/supabase/server'

/**
 * Shared helper for the actions/team-*.ts modules (team.ts split by
 * concern). No 'use server' here: this is a plain helper called from
 * server action files, not an action invoked directly from the client.
 */

/** True if `userId` is the account owner or an account admin. */
export async function isAccountManager(
  admin: ReturnType<typeof createAdminClient>,
  accountId: string,
  userId: string,
): Promise<boolean> {
  const { data: acc } = await admin
    .from('accounts')
    .select('owner_user_id')
    .eq('id', accountId)
    .maybeSingle()
  if (acc?.owner_user_id === userId) return true
  const { data: am } = await admin
    .from('account_members')
    .select('role')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .maybeSingle()
  return am?.role === 'admin'
}
