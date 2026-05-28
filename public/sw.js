/**
 * Althos CRM — service worker.
 *
 * Two responsibilities:
 *   1. Cache static assets (/_next/static, icons, manifest) for fast load.
 *   2. Handle Web Push notifications — show them and navigate on click.
 *
 * Bump CACHE_VERSION when shipping a strategy change.
 */

const CACHE_VERSION = 'althos-v1'
const STATIC_CACHE  = `${CACHE_VERSION}-static`

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      // Delete caches from previous versions.
      const keys = await caches.keys()
      await Promise.all(
        keys.filter(k => !k.startsWith(CACHE_VERSION)).map(k => caches.delete(k)),
      )
      await self.clients.claim()
    })(),
  )
})

// ---------------------------------------------------------------------------
// Fetch — stale-while-revalidate for static assets only
// ---------------------------------------------------------------------------

self.addEventListener('fetch', event => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // Hard skip: dynamic, auth, per-user routes.
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth') ||
    url.pathname.startsWith('/app/') ||
    url.pathname.startsWith('/super-admin') ||
    url.pathname === '/' ||
    req.headers.get('accept')?.includes('text/html')
  ) {
    return
  }

  const cacheable =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icon')           ||
    url.pathname === '/manifest.webmanifest'   ||
    /\.(?:js|css|woff2?|ttf|otf|svg|png|jpg|jpeg|webp|ico)$/.test(url.pathname)

  if (!cacheable) return

  event.respondWith(
    (async () => {
      const cache  = await caches.open(STATIC_CACHE)
      const cached = await cache.match(req)
      if (cached) {
        event.waitUntil(
          fetch(req)
            .then(res => { if (res?.ok) cache.put(req, res.clone()) })
            .catch(() => {}),
        )
        return cached
      }
      try {
        const res = await fetch(req)
        if (res?.ok) cache.put(req, res.clone())
        return res
      } catch {
        return Response.error()
      }
    })(),
  )
})

// ---------------------------------------------------------------------------
// Push — receive and display notifications
// ---------------------------------------------------------------------------

self.addEventListener('push', event => {
  if (!event.data) return

  let data
  try {
    data = event.data.json()
  } catch {
    // Malformed payload — show a generic notification rather than swallowing.
    data = { title: 'Althos CRM', body: event.data.text() }
  }

  const title   = data.title   || 'Althos CRM'
  const options = {
    body:            data.body    || '',
    icon:            data.icon    || '/icon.svg',
    badge:           '/icon.svg',
    tag:             data.tag     || 'althos-default',
    // Replace earlier notification with the same tag instead of stacking.
    renotify:        !!data.tag,
    // Persist until the user interacts (important for task/lead alerts).
    requireInteraction: false,
    data: {
      url: data.data?.url || '/',
    },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// ---------------------------------------------------------------------------
// Notification click — navigate to the relevant deep-link
// ---------------------------------------------------------------------------

self.addEventListener('notificationclick', event => {
  event.notification.close()

  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    (async () => {
      // If there's already an open window on our origin, focus it and
      // navigate — avoids opening a second tab.
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of clients) {
        const clientUrl = new URL(client.url)
        if (clientUrl.origin === self.location.origin) {
          await client.focus()
          await client.navigate(targetUrl)
          return
        }
      }
      // No open window — open a new one.
      await self.clients.openWindow(targetUrl)
    })(),
  )
})
