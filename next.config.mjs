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
  // connect.facebook.net serves the Meta JS SDK used by the WhatsApp
  // Embedded Signup button (Conectar WhatsApp em Configurações).
  `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval'" : ''} https://challenges.cloudflare.com https://connect.facebook.net`,

  // Styles: same-origin + inline (Tailwind / shadcn inject style tags).
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,

  // Fonts: Google Fonts static files (Next.js font optimisation proxies them,
  // but some remain on gstatic in dev).
  `font-src 'self' https://fonts.gstatic.com`,

  // Images: same-origin + data URIs (for SVG/base64) + Supabase Storage
  // (user-uploaded avatars/documents served from the bucket) + OpenStreetMap
  // tiles (mapa interativo da proposta pública) + TripAdvisor photo CDN
  // (fotos de hospedagem puxadas via Terra API em Cotações) + Unsplash
  // photo CDN (busca de foto de capa em Cotações) + Instagram CDN (foto de
  // perfil do contato no inbox de DM).
  `img-src 'self' data: blob: https://${supabaseHostname} https://*.tile.openstreetmap.org https://tile.openstreetmap.org https://dynamic-media.tacdn.com https://images.unsplash.com https://*.cdninstagram.com`,

  // Áudio/vídeo (elementos <audio>/<video>) — mídia recebida via WhatsApp,
  // baixada e salva no Storage (bucket whatsapp-media, mesmo host acima).
  // Não é coberto por img-src; sem isso, cai no default-src 'self' e bloqueia.
  `media-src 'self' blob: https://${supabaseHostname}`,

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
    // O fluxo de WhatsApp Embedded Signup navega internamente por vários
    // subdomínios (graph., www., business.facebook.com confirmado — é o
    // domínio do link de teste que funcionou — possivelmente outros). Sem
    // isso liberado, o CSP bloqueia silenciosamente a comunicação entre o
    // popup e o SDK, sem erro nenhum no console — o popup completa
    // visualmente, mas nada chega na página.
    `https://*.facebook.com`,
    `https://connect.facebook.net`,
    // Inngest Dev Server in local dev
    isDev ? 'http://localhost:8288' : '',
  ]
    .filter(Boolean)
    .join(' '),

  // Iframe embeds: Turnstile challenge widget + YouTube (vídeos da Vitrine)
  // + qualquer subdomínio da Meta (iframes ocultos do SDK pro Embedded
  // Signup do WhatsApp se comunicarem entre domínios).
  `frame-src 'self' https://challenges.cloudflare.com https://www.youtube.com https://www.youtube-nocookie.com https://*.facebook.com`,

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
          // Gravação de áudio no chat (WhatsApp/Instagram) usa
          // getUserMedia — 'microphone=()' bloqueava a permissão antes
          // até do navegador poder perguntar, sem erro nenhum visível
          // além do catch genérico.
          'microphone=(self)',
          'geolocation=()',
          'payment=()',
          'usb=()',
          'magnetometer=()',
          'gyroscope=()',
        ].join(', '),
      },
      // 'same-origin' corta window.opener assim que um popup navega pra um
      // domínio diferente — quebra silenciosamente o WhatsApp Embedded
      // Signup (FB.login abre um popup em facebook.com; sem essa referência,
      // o SDK nunca consegue reportar o resultado de volta pra essa aba,
      // mesmo com o popup completando normalmente). 'same-origin-allow-popups'
      // mantém a proteção de isolamento de processo pra tudo mais, só libera
      // popups explicitamente abertos por nós.
      {
        key: 'Cross-Origin-Opener-Policy',
        value: 'same-origin-allow-popups',
      },
      // Prevent other origins from loading our resources (JS/CSS/images).
      {
        key: 'Cross-Origin-Resource-Policy',
        value: 'same-origin',
      },
    ],
  },
]

/**
 * `/pricing` was a stale duplicate of `/planos` (wrong domain in its own
 * metadata, prices out of sync with the real plan config, and never linked
 * from anywhere in the app) — redirect it instead of maintaining two pricing
 * pages that compete with each other for the same search intent.
 */
const redirects = async () => [
  { source: '/pricing', destination: '/planos', permanent: true },
  // Nichos descontinuados (substituídos por Advocacia e Corretoras de Seguros
  // na reestruturação de nichos estratégicos) — redireciona pra home em vez
  // de deixar 404 pra quem tinha o link salvo/indexado.
  { source: '/veiculos', destination: '/', permanent: true },
  { source: '/trafego', destination: '/', permanent: true },
  { source: '/pequenas-empresas', destination: '/', permanent: true },
]

const nextConfig = {
  headers: securityHeaders,
  redirects,
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
