/**
 * Web Push senders — internal only, deliberately NOT in a 'use server' file.
 *
 * `sendPushToUser`/`sendPushToOrg` used to live in actions/push.ts (a 'use
 * server' file). Every exported async function in a 'use server' file becomes
 * a callable server-action endpoint, even when every real call site is
 * server-side internal code (Inngest crons, other actions) — so despite the
 * "internal helper" intent, they were reachable directly by anyone who could
 * invoke the action, with no check that the caller may notify the given
 * user/org. Since nothing here needs to be called from a Client Component,
 * moving them out of the 'use server' boundary removes that surface entirely
 * (rather than adding an auth check that would have broken the Inngest/cron
 * callers, which run with no user session to check against).
 *
 * actions/push.ts re-exports these two for backward-compatible import paths.
 */

import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/server'
import { isNotificationEnabledBatch, filterUsersByCategory } from '@/actions/notifications'
import type { NotificationCategory } from '@/lib/notifications/categories'

// Configure VAPID once — Node modules are cached so this runs once per
// cold-start, not once per request.
function getWebPush() {
  // The public key is the same value the browser uses to subscribe. Accept the
  // server-only name first, but fall back to the NEXT_PUBLIC_ one so a deploy
  // that only set the public-facing variable still works (common misconfig).
  const publicKey  = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject    = process.env.VAPID_SUBJECT || 'mailto:suporte@althoscrm.com.br'

  if (!publicKey || !privateKey) {
    throw new Error(
      'VAPID keys must be set to use push notifications (NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY).',
    )
  }

  webpush.setVapidDetails(subject, publicKey, privateKey)
  return webpush
}

export type PushPayload = {
  title: string
  body: string
  /** Deep-link opened when the user taps the notification. */
  url?: string
  /** Badge count for mobile home-screen icon (optional). */
  badge?: number
  /** Icon shown in the notification (defaults to /icon.svg). */
  icon?: string
  tag?: string
  /**
   * Notification category. When set, the dispatcher honours the recipient's
   * per-user preferences and skips delivery to anyone who opted the category
   * out. When unset, the notification is always delivered (legacy behaviour).
   */
  category?: NotificationCategory
}

/**
 * Sends a push notification to every opted-in device of `userId`.
 * Uses the admin client so it can read subscriptions belonging to other users
 * (e.g. when a lead is assigned to a seller by a manager).
 *
 * Expired / invalid subscriptions are cleaned up automatically on 410 Gone.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number; failed: number }> {
  const wp = getWebPush()
  const admin = createAdminClient()

  const { data: allSubs } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, organization_id')
    .eq('user_id', userId)

  if (!allSubs || allSubs.length === 0) return { sent: 0, failed: 0 }

  // Honour per-user category preferences (per org). A user may have subs in
  // several orgs; keep only those where the category is enabled.
  let subs = allSubs
  if (payload.category) {
    const orgIds = Array.from(new Set(allSubs.map(s => s.organization_id as string)))
    const enabledOrgs = await isNotificationEnabledBatch(userId, orgIds, payload.category)
    subs = allSubs.filter(s => enabledOrgs.has(s.organization_id as string))
    if (subs.length === 0) return { sent: 0, failed: 0 }
  }

  const notification = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || '/logo-mark.png',
    badge: payload.badge,
    tag: payload.tag,
    data: { url: payload.url || '/' },
  })

  let sent = 0
  let failed = 0

  await Promise.allSettled(
    subs.map(async sub => {
      try {
        await wp.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          notification,
        )
        // Touch last_used_at to track active subscriptions.
        await admin
          .from('push_subscriptions')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', sub.id)
        sent++
      } catch (err: any) {
        // 410 Gone = subscription expired / user unsubscribed in the browser
        // without us knowing. Clean it up so we don't keep hitting it.
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await admin.from('push_subscriptions').delete().eq('id', sub.id)
        } else {
          console.error('[push] send error for', sub.endpoint, err?.message)
        }
        failed++
      }
    }),
  )

  return { sent, failed }
}

/** Broadcast to all opted-in members of an org. */
export async function sendPushToOrg(
  orgId: string,
  payload: PushPayload,
): Promise<{ sent: number; failed: number }> {
  const wp = getWebPush()
  const admin = createAdminClient()

  const { data: allSubs } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, user_id')
    .eq('organization_id', orgId)

  if (!allSubs || allSubs.length === 0) return { sent: 0, failed: 0 }

  // Honour per-user category preferences: keep only subscriptions whose owner
  // is opted-in to this category.
  let subs = allSubs
  if (payload.category) {
    const allowed = new Set(
      await filterUsersByCategory(
        allSubs.map(s => s.user_id as string),
        orgId,
        payload.category,
      ),
    )
    subs = allSubs.filter(s => allowed.has(s.user_id as string))
    if (subs.length === 0) return { sent: 0, failed: 0 }
  }

  const notification = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || '/logo-mark.png',
    badge: payload.badge,
    tag: payload.tag,
    data: { url: payload.url || '/' },
  })

  let sent = 0
  let failed = 0

  await Promise.allSettled(
    subs.map(async sub => {
      try {
        await wp.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          notification,
        )
        await admin
          .from('push_subscriptions')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', sub.id)
        sent++
      } catch (err: any) {
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await admin.from('push_subscriptions').delete().eq('id', sub.id)
        } else {
          console.error('[push] broadcast error for', sub.endpoint, err?.message)
        }
        failed++
      }
    }),
  )

  return { sent, failed }
}
