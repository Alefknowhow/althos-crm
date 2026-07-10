/** @type {import('next').NextConfig} */

/**
 * Security headers applied to every response.
 *
 * Design choices:
 *
 * CSP — "defence in depth" tier rather than strict-dynamic/nonce. Next.js
 * App Router injects inline scripts for RSC hydration that would require a
 * nonce pipeline (middleware → layout → every page). That's a meaningful
 * refactor; for now we allow unsafe-inline on scripts (mitigated by the
 * other directives) and tighten every other vector:
 *   • connect-src restricts data exfiltration to known endpoints.
 *   • frame-ancestors 'none' defeats clickjacking without X-Frame-Options
 *     (but we send both for old-UA compat).
 *   • object-src 'none' kills plugin-based attacks.
 *   • base-uri 'self' prevents <base> injection.
 *
 * Upgrade to nonce-based CSP when Next.js stable CSP helpers ship.
 */

const isDev = process.env.NODE_ENV === 'development'

// Supabase project hostname — pulled at build time so the CSP is exact.
// Falls back to wildcard on supabase.co so the app still works if the env
// var isn't set during a local build.
const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : '*.supabase.co'

// Websocket variant used by Supabase Realtime.
const supabaseWs = supabaseHostname.startsWith('*')
  ? 'wss://*.supabase.co'
  : `wss://${supabaseHostname}`

const ContentSecurityPolicy = [
  // Only load resources from the same origin by default.
  `default-src 'self'`,

  // Scripts: same-origin + inline (needed for Next.js RSC hydration chunks).
  // Cloudflare Turnstile script is loaded client-side from their CDN.
  `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval'" : ''} https://challenges.cloudflare.com`,

  // Styles: same-origin + inline (Tailwind / shadcn inject style tags).
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,

  // Fonts: Google Fonts static files (Next.js font optimisation proxies them,
  // but some remain on gstatic in dev).
  `font-src 'self' https://fonts.gstatic.com`,

  // Images: same-origin + data URIs (for SVG/base64) + Supabase Storage
  // (user-uploaded avatars/documents served from the bucket) + OpenStreetMap
  // tiles (mapa interativo da proposta pública).
  `img-src 'self' data: blob: https://${supabaseHostname} https://*.tile.openstreetmap.org https://tile.openstreetmap.org`,

  // Fetch / XHR / WebSocket connections allowed to known external services.
  // This is the most impactful restriction — exfiltrating data to an
  // attacker-controlled server requires it to be in this list.
  [
    `connect-src 'self'`,
    `https://${supabaseHostname}`,
    supabaseWs,
    `https://api.inngest.com`,
    `https://api.anthropic.com`,
    `https://api.resend.com`,
    `https://viacep.com.br`,
    `https://challenges.cloudflare.com`,
    `https://graph.facebook.com`,
    // Inngest Dev Server in local dev
    isDev ? 'http://localhost:8288' : '',
  ]
    .filter(Boolean)
    .join(' '),

  // Iframe embeds: Turnstile challenge widget + YouTube (vídeos da Vitrine).
  `frame-src 'self' https://challenges.cloudflare.com https://www.youtube.com https://www.youtube-nocookie.com`,

  // Block <object>, <embed>, <applet> — vectors for plugin exploits.
  `object-src 'none'`,

  // Prevent <base href="..."> injection attacks.
  `base-uri 'self'`,

  // form-action: restrict POST targets to same origin so a XSS can't
  // redirect a form submission to an attacker's server.
  `form-action 'self'`,

  // Upgrade insecure requests — force http:// sub-resources to https://.
  ...(isDev ? [] : [`upgrade-insecure-requests`]),

  // Disallow embedding this app in any frame on any other origin.
  `frame-ancestors 'none'`,
]
  .filter(Boolean)
  .join('; ')

/** @type {import('next').NextConfig['headers']} */
const securityHeaders = async () => [
  {
    // Apply to every route — public pages, API, assets.
    source: '/(.*)',
    headers: [
      {
        key: 'Content-Security-Policy',
        value: ContentSecurityPolicy,
      },
      // Prevent MIME-type sniffing. Browsers must respect Content-Type.
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
      },
      // Clickjacking defence (belt-and-suspenders with CSP frame-ancestors).
      {
        key: 'X-Frame-Options',
        value: 'DENY',
      },
      // No referrer sent cross-origin — keeps internal paths private.
      {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin',
      },
      // HSTS: force HTTPS for 1 year + include subdomains. Only in prod —
      // localhost does not have HTTPS so dev would break.
      ...(!isDev
        ? [
            {
              key: 'Strict-Transport-Security',
              value: 'max-age=31536000; includeSubDomains; preload',
            },
          ]
        : []),
      // Restrict browser feature access. Principle of least privilege — only
      // enable what the app actually uses (camera/mic for future video calls
      // can be added here).
      {
        key: 'Permissions-Policy',
        value: [
          'camera=()',
          'microphone=()',
          'geolocation=()',
          'payment=()',
          'usb=()',
          'magnetometer=()',
          'gyroscope=()',
        ].join(', '),
      },
      // Tell browsers not to send credentials in cross-origin requests unless
      // explicitly requested.
      {
        key: 'Cross-Origin-Opener-Policy',
        value: 'same-origin',
      },
      // Prevent other origins from loading our resources (JS/CSS/images).
      {
        key: 'Cross-Origin-Resource-Policy',
        value: 'same-origin',
      },
    ],
  },
]

const nextConfig = {
  headers: securityHeaders,
  eslint: { ignoreDuringBuilds: true },

  experimental: {
    // Client-side Router Cache retention. This keeps already-visited pages
    // "warm" in the browser so navigating back to them is instant — WITHOUT
    // any new server render or database query. It is pure client-side reuse,
    // so it can only reduce DB load, never increase it.
    //
    // This is what makes bouncing between the heavy work screens (Conversas,
    // Pipeline, Reservas, Cotações) feel fluid: the first visit loads normally
    // (the sidebar <Link> prefetches gently, one at a time on hover/viewport),
    // and every return visit within the window reuses the cached screen.
    //
    // NOTE: deliberately NOT reintroducing an eager multi-route prefetcher —
    // a previous one (components/prefetch-routes.tsx) fired 11 concurrent
    // full-render prefetches and caused a production outage (removed in
    // 007f256). staleTimes is the safe, DB-free way to achieve warmth.
    //
    //   dynamic — pages with dynamic data (our authed /app/* screens). 120s
    //             means a return visit within 2 min reuses the cached render.
    //             Live data still updates via Realtime subscriptions on the
    //             client; this only governs the navigation snapshot.
    //   static  — fully static segments; safe to hold longer.
    staleTimes: {
      dynamic: 120,
      static: 300,
    },
  },
}

export default nextConfig
