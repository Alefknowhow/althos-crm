'use client'

/**
 * PushNotificationToggle
 *
 * One-click opt-in/opt-out for Web Push notifications. Lives in the org
 * layout header (next to the notification bell) so it's always reachable.
 *
 * State machine:
 *   unsupported  — browser / OS / SW doesn't support Push API. Button hidden.
 *   denied       — user blocked notifications in browser settings. Show hint.
 *   unsubscribed — default. Bell icon invites to enable.
 *   loading      — subscribing / unsubscribing in flight.
 *   subscribed   — active. Bell-filled icon + tooltip to disable.
 *
 * VAPID public key is read from NEXT_PUBLIC_VAPID_PUBLIC_KEY. If unset the
 * component renders nothing (same as unsupported) — safe for deployments
 * without push configured.
 */

import { useEffect, useState } from 'react'
import { Bell, BellOff, BellRing, Loader2 } from 'lucide-react'
import { subscribeToPush, unsubscribeFromPush } from '@/actions/push'
import { cn } from '@/lib/utils'

type PushState = 'unsupported' | 'denied' | 'unsubscribed' | 'loading' | 'subscribed'

export default function PushNotificationToggle({ orgSlug }: { orgSlug: string }) {
  const [state, setState] = useState<PushState>('unsupported')
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null)

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

  useEffect(() => {
    if (!vapidPublicKey) return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

    const permission = Notification.permission
    if (permission === 'denied') {
      setState('denied')
      return
    }

    // Check if we already have an active subscription.
    navigator.serviceWorker.ready.then(reg => {
      reg.pushManager.getSubscription().then(sub => {
        if (sub) {
          setState('subscribed')
          setCurrentEndpoint(sub.endpoint)
        } else {
          setState('unsubscribed')
        }
      })
    })
  }, [vapidPublicKey])

  if (state === 'unsupported' || !vapidPublicKey) return null

  async function enable() {
    setState('loading')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'unsubscribed')
        return
      }

      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // Cast needed: TS PushSubscriptionOptionsInit expects BufferSource but
        // Uint8Array<ArrayBufferLike> from urlBase64ToUint8Array doesn't satisfy
        // the stricter ArrayBuffer constraint in some TS lib versions.
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey!) as unknown as BufferSource,
      })

      const res = await subscribeToPush(
        orgSlug,
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: arrayBufferToBase64(sub.getKey('p256dh')!),
            auth:   arrayBufferToBase64(sub.getKey('auth')!),
          },
        },
        navigator.userAgent,
      )

      if (res.ok) {
        setCurrentEndpoint(sub.endpoint)
        setState('subscribed')
      } else {
        console.error('[push] subscribe action failed:', res.error)
        setState('unsubscribed')
      }
    } catch (err) {
      console.error('[push] enable error:', err)
      setState('unsubscribed')
    }
  }

  async function disable() {
    if (!currentEndpoint) return
    setState('loading')
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) await sub.unsubscribe()
      await unsubscribeFromPush(currentEndpoint)
      setCurrentEndpoint(null)
      setState('unsubscribed')
    } catch (err) {
      console.error('[push] disable error:', err)
      setState('subscribed')
    }
  }

  if (state === 'denied') {
    return (
      <button
        type="button"
        disabled
        title="Notificações bloqueadas nas configurações do navegador"
        className="w-8 h-8 inline-flex items-center justify-center rounded-md text-muted-foreground/40 cursor-not-allowed"
      >
        <BellOff className="w-4 h-4" />
      </button>
    )
  }

  if (state === 'loading') {
    return (
      <button
        type="button"
        disabled
        className="w-8 h-8 inline-flex items-center justify-center rounded-md text-muted-foreground"
      >
        <Loader2 className="w-4 h-4 animate-spin" />
      </button>
    )
  }

  if (state === 'subscribed') {
    return (
      <button
        type="button"
        onClick={disable}
        title="Notificações push ativas — clique para desativar"
        className={cn(
          'w-8 h-8 inline-flex items-center justify-center rounded-md transition-colors',
          'text-primary hover:text-primary/70 hover:bg-muted',
        )}
      >
        <BellRing className="w-4 h-4" />
      </button>
    )
  }

  // unsubscribed
  return (
    <button
      type="button"
      onClick={enable}
      title="Ativar notificações push"
      className="w-8 h-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
    >
      <Bell className="w-4 h-4" />
    </button>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert VAPID public key from URL-safe base64 to Uint8Array. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64   = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw      = window.atob(base64)
  const output   = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i)
  }
  return output
}

/** Convert ArrayBuffer (from PushSubscription.getKey) to base64 string. */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const chars: string[] = []
  bytes.forEach(b => chars.push(String.fromCharCode(b)))
  return btoa(chars.join(''))
}
