'use server'

/**
 * Web Push notification actions.
 *
 * Three public entry points:
 *   subscribeToPush    — called by the browser after getting permission +
 *                        PushSubscription from the SW. Upserts the row.
 *   unsubscribeFromPush — removes the subscription row (browser unsubscribe
 *                         should precede this, but we clean up regardless).
 *   sendPushToUser     — internal helper used by Inngest triggers and other
 *                        server-side code to push a notification to every
 *                        opted-in device of a given user.
 *   sendPushToOrg      — broadcast to ALL opted-in members of an org.
 *
 * VAPID keys are required. Generate once with:
 *   node -e "const wp=require('web-push'); console.log(wp.generateVAPIDKeys())"
 * then set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT in .env.
 */

import webpush from 'web-push'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/supabase/types'
import { isNotificationEnabled, filterUsersByCategory } from '@/actions/notifications'
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Send to a specific user (all their devices)
// ---------------------------------------------------------------------------

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
    const enabledOrgs = new Set<string>()
    await Promise.all(
      orgIds.map(async orgId => {
        if (await isNotificationEnabled(userId, orgId, payload.category!)) enabledOrgs.add(orgId)
      }),
    )
    subs = allSubs.filter(s => enabledOrgs.has(s.organization_id as string))
    if (subs.length === 0) return { sent: 0, failed: 0 }
  }

  const notification = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || '/icon.svg',
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

// ---------------------------------------------------------------------------
// Broadcast to all opted-in members of an org
// ---------------------------------------------------------------------------

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
    icon: payload.icon || '/icon.svg',
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
