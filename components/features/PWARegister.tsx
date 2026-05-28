'use client'

/**
 * Registers the PWA service worker once on app load.
 *
 * We only register in production — running the SW in `next dev` causes
 * hot-reload assets to get stale-cached and is generally more pain than
 * gain.
 *
 * The SW itself (see public/sw.js) is conservative: it only caches static
 * fingerprinted assets and never touches HTML, /api, or /app routes. So
 * users never see stale tenant data.
 */

import { useEffect } from 'react'

export default function PWARegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    if (process.env.NODE_ENV !== 'production') return

    // Wait for load so SW registration doesn't compete with critical paint.
    const onLoad = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch(err => {
          // Swallow — PWA is a progressive enhancement, not a requirement.
          console.warn('SW register failed:', err)
        })
    }

    if (document.readyState === 'complete') {
      onLoad()
    } else {
      window.addEventListener('load', onLoad, { once: true })
      return () => window.removeEventListener('load', onLoad)
    }
  }, [])

  return null
}
