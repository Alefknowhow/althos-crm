'use client'

/**
 * usePushNotification
 *
 * Shared state machine for Web Push opt-in/opt-out. Extracted from
 * PushNotificationToggle so both the desktop icon button and the mobile
 * consolidated menu (HeaderMobileMenu) can drive the same subscribe/
 * unsubscribe logic without duplicating it.
 */

import { useEffect, useState } from 'react'
import { subscribeToPush, unsubscribeFromPush } from '@/actions/push'

export type PushState = 'unsupported' | 'denied' | 'unsubscribed' | 'loading' | 'subscribed'

export function usePushNotification(orgSlug: string) {
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

    let cancelled = false
    getRegistration()
      .then(reg => reg.pushManager.getSubscription())
      .then(sub => {
        if (cancelled) return
        if (sub) {
          setState('subscribed')
          setCurrentEndpoint(sub.endpoint)
        } else {
          setState('unsubscribed')
        }
      })
      .catch(() => {
        if (!cancelled) setState('unsubscribed')
      })

    return () => {
      cancelled = true
    }
  }, [vapidPublicKey])

  async function enable() {
    if (!vapidPublicKey) return
    setState('loading')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'unsubscribed')
        return
      }

      const reg = await getRegistration()
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource,
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
      const reg = await getRegistration()
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

  return { state, enable, disable, supported: !!vapidPublicKey }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve an active ServiceWorkerRegistration without ever hanging.
 *
 * `navigator.serviceWorker.ready` only resolves once a worker is *active*. If
 * the SW was never registered (PWARegister only runs in production and swallows
 * errors) it never resolves. Strategy: explicitly register /sw.js (idempotent),
 * then race `.ready` against a timeout so a stuck activation can't block the UI.
 */
async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })

  if (reg.active) return reg

  const ready = navigator.serviceWorker.ready
  const timeout = new Promise<ServiceWorkerRegistration>((_, reject) =>
    setTimeout(() => reject(new Error('service worker activation timed out')), 10_000),
  )
  try {
    return await Promise.race([ready, timeout])
  } catch {
    return reg
  }
}

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
