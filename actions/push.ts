'use server'

/**
 * Web Push notification actions — client-callable entry points.
 *
 *   subscribeToPush    — called by the browser after getting permission +
 *                        PushSubscription from the SW. Upserts the row.
 *   unsubscribeFromPush — removes the subscription row (browser unsubscribe
 *                         should precede this, but we clean up regardless).
 *
 * `sendPushToUser`/`sendPushToOrg` moved to lib/push/send.ts — they're
 * internal-only (Inngest crons, other server actions), never meant to be
 * called from the client, so they don't belong in a 'use server' file (every
 * export here becomes a callable action endpoint, and Next's "use server"
 * compiler in fact rejects even a plain re-export of them from here). Import
 * them directly from '@/lib/push/send' instead.
 *
 * VAPID keys are required. Generate once with:
 *   node -e "const wp=require('web-push'); console.log(wp.generateVAPIDKeys())"
 * then set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT in .env.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/supabase/types'

// ---------------------------------------------------------------------------
// Subscribe
// ---------------------------------------------------------------------------

export async function subscribeToPush(
  orgSlug: string,
  subscription: {
    endpoint: string
    keys: { p256dh: string; auth: string }
  },
  userAgent?: string,
) {
  const user = await requireAuth()
  const supabase = createClient()

  // Resolve org_id from slug.
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', orgSlug)
    .single()

  if (!org) return { ok: false, error: 'Org not found' }

  // Upsert by endpoint — if the browser re-subscribes (e.g. after clearing
  // site data) the endpoint changes and we get a fresh row.
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      organization_id: org.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      user_agent: userAgent || null,
      last_used_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' },
  )

  if (error) {
    console.error('[push] subscribe error:', error.message)
    return { ok: false, error: error.message }
  }

  return { ok: true }
}

// ---------------------------------------------------------------------------
// Unsubscribe
// ---------------------------------------------------------------------------

export async function unsubscribeFromPush(endpoint: string) {
  const user = await requireAuth()
  const supabase = createClient()

  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', endpoint)

  return { ok: true }
}
