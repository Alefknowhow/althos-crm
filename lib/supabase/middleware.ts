import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Route classification — drives auth gating and redirect logic.
 *
 * PUBLIC: anyone can access — no session required.
 * AUTHENTICATED: requires a valid Supabase session; redirect to /login otherwise.
 * SUPER_ADMIN: requires session + super-admin flag (checked in the layout, but
 *              we still require auth here as a first gate).
 */
function classifyRoute(pathname: string): 'public' | 'authenticated' | 'super_admin' {
  // Fully-public pages / embeds
  if (
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/verify-email' ||   // post-signup "check your email" screen
    pathname === '/forgot-password' || // password reset request
    pathname === '/onboarding' ||
    pathname === '/privacidade' ||    // public privacy policy (required by Meta)
    pathname === '/termos' ||         // public terms of service
    pathname === '/cookies' ||        // public cookie policy
    pathname === '/funcionalidades' || // marketing: features
    pathname === '/para-quem-e' ||     // marketing: who it's for
    pathname === '/por-que-nos' ||     // marketing: why us
    pathname === '/como-funciona' ||   // marketing: how it works
    pathname === '/planos' ||          // marketing: pricing
    pathname === '/viagens' ||         // niche LP: agências de viagens
    pathname === '/imobiliarias' ||    // niche LP: imobiliárias
    pathname === '/clinicas' ||        // niche LP: clínicas
    pathname === '/veiculos' ||        // niche LP: lojas de veículos
    pathname === '/trafego' ||         // niche LP: agências de tráfego
    pathname === '/pequenas-empresas' || // niche LP: pequenas empresas
    pathname === '/faq' ||             // marketing: FAQ
    pathname === '/robots.txt' ||      // SEO: crawler directives (must not 307→login)
    pathname === '/sitemap.xml' ||     // SEO: sitemap
    pathname === '/blog' ||            // marketing: blog index
    pathname.startsWith('/blog/')   ||  // marketing: blog posts
    pathname.startsWith('/auth/')    ||  // auth callbacks (email confirm, OAuth)
    pathname.startsWith('/f/')       ||  // public forms
    pathname.startsWith('/book/')    ||  // public booking pages
    pathname.startsWith('/p/')       ||  // public travel proposals (cliente final, sem login)
    pathname.startsWith('/v/')       ||  // public vitrine / ofertas (sem login)
    pathname.startsWith('/docs/')    ||  // documentation
    pathname.startsWith('/api/webhooks/') ||  // webhook receivers (self-authenticate)
    pathname.startsWith('/api/inngest')        // Inngest event API
  ) {
    return 'public'
  }

  if (pathname.startsWith('/super-admin')) {
    return 'super_admin'
  }

  // Anything else (/app/*, /settings, /onboarding/*, etc.)
  return 'authenticated'
}

/**
 * Normalized auth facts the middleware needs, derived from the verified JWT.
 */
type AuthCtx = {
  id: string
  emailVerified: boolean
  aal: string | null
  mfaEnrolled: boolean
  appMeta: { role?: string; is_super_admin?: boolean }
}

/**
 * Resolve the request's auth context via local JWT verification (Lever A).
 *
 * `getClaims()` verifies the access token's signature locally — no network
 * round-trip — once the project uses asymmetric ES256 signing keys: it fetches
 * the JWKS once, caches it, and verifies every subsequent token at the edge.
 * While the project still uses the legacy symmetric secret it transparently
 * falls back to a server call, so this code is safe to ship before the keys are
 * switched (it simply behaves like the old getUser() until then).
 *
 * The two app-specific facts — whether the email is verified and whether MFA is
 * enrolled — are injected as tamper-proof top-level claims by the Custom Access
 * Token Hook (the hook runs server-side reading auth.users / auth.mfa_factors,
 * so a user cannot forge them via user_metadata).
 *
 * SELF-HEALING: a token minted before the hook was enabled won't carry those two
 * claims; for it we fall back once to the authoritative getUser() to derive them.
 * As sessions refresh (≤1h) this branch stops firing and every request becomes a
 * pure local verification.
 */
async function resolveAuth(
  supabase: ReturnType<typeof createServerClient>,
): Promise<{ ctx: AuthCtx | null; error: { status?: number; message: string } | null }> {
  const { data, error } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (!claims) return { ctx: null, error: error ?? null }

  const aal = typeof claims.aal === 'string' ? claims.aal : null
  const appMeta = (claims.app_metadata ?? {}) as { role?: string; is_super_admin?: boolean }

  const hookEmailVerified =
    typeof claims.email_verified === 'boolean' ? claims.email_verified : undefined
  const hookMfaEnrolled =
    typeof claims.mfa_enrolled === 'boolean' ? claims.mfa_enrolled : undefined

  // Pre-hook token — derive the missing fact(s) authoritatively, once.
  if (hookEmailVerified === undefined || hookMfaEnrolled === undefined) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ctx: null, error: null }
    return {
      ctx: {
        id: user.id,
        emailVerified: !!user.email_confirmed_at,
        aal,
        mfaEnrolled: (user.factors ?? []).some((f: { status: string }) => f.status === 'verified'),
        appMeta: (user.app_metadata ?? {}) as { role?: string; is_super_admin?: boolean },
      },
      error: null,
    }
  }

  return {
    ctx: {
      id: String(claims.sub),
      emailVerified: hookEmailVerified,
      aal,
      mfaEnrolled: hookMfaEnrolled,
      appMeta,
    },
    error: null,
  }
}

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl
  const routeClass = classifyRoute(pathname)

  // PERF: genuinely public routes (landing, marketing, blog, public forms,
  // webhooks, etc.) don't need an auth decision, so skip the Supabase
  // `auth.getUser()` network round-trip entirely — that call was running on
  // EVERY request, including anonymous/bot/prefetch traffic. Only /login and
  // /signup are "public" yet still need the session (to bounce already
  // logged-in users), so they fall through to the full path below.
  const needsSession =
    routeClass !== 'public' || pathname === '/login' || pathname === '/signup'
  if (!needsSession) {
    return NextResponse.next({ request: { headers: request.headers } })
  }

  let supabaseResponse = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          supabaseResponse = NextResponse.next({
            request: { headers: request.headers },
          })
          supabaseResponse.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          supabaseResponse = NextResponse.next({
            request: { headers: request.headers },
          })
          supabaseResponse.cookies.set({ name, value: '', ...options })
        },
      },
    },
  )

  // ---- Lever A: local JWT verification (getClaims) ----
  // Resolve the request's auth context. Once ES256 signing keys + the Custom
  // Access Token Hook are live this is a pure local verification (no network);
  // until then it transparently falls back to getUser() (see resolveAuth).
  const { ctx, error: authError } = await resolveAuth(supabase)

  // Log suspicious Supabase auth errors (not "not logged in" 401s, those are
  // normal, but unexpected 5xx or malformed token errors are worth knowing).
  if (authError && authError.status && authError.status >= 500) {
    console.error('[middleware] Supabase auth error:', authError.message)
  }

  // ---- Not authenticated ----
  if (!ctx) {
    if (routeClass === 'authenticated' || routeClass === 'super_admin') {
      // Preserve the intended destination so login can redirect back.
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/login'
      // Pass the original URL as ?next= only for app routes (not API, not
      // webhooks) so login can redirect back after authentication.
      if (pathname.startsWith('/app/')) {
        loginUrl.searchParams.set('next', pathname)
      }
      console.warn('[middleware] unauthenticated access blocked:', pathname)
      return NextResponse.redirect(loginUrl)
    }
    // Public route — pass through with refreshed session cookie.
    return supabaseResponse
  }

  // ---- Authenticated ----

  // Bounce logged-in users away from login/signup to avoid confusion.
  if (pathname === '/login' || pathname === '/signup') {
    const dest = request.nextUrl.clone()
    // If email not confirmed yet, keep them on the verify-email screen.
    dest.pathname = ctx.emailVerified ? '/onboarding' : '/verify-email'
    return NextResponse.redirect(dest)
  }

  // Block authenticated-but-unconfirmed users from accessing app routes.
  if (!ctx.emailVerified && routeClass === 'authenticated') {
    const dest = request.nextUrl.clone()
    dest.pathname = '/verify-email'
    return NextResponse.redirect(dest)
  }

  // ---- Two-factor (MFA) enforcement ----
  // If the user has enrolled a verified MFA factor but the current session is
  // still at assurance level aal1 (password only), force them through the /mfa
  // challenge before any authenticated route. The /mfa page itself is exempt to
  // avoid a redirect loop. Both facts come straight from the verified JWT claims
  // (`mfa_enrolled` from the hook, the standard `aal` claim) — no extra round-trip.
  if (
    (routeClass === 'authenticated' || routeClass === 'super_admin') &&
    pathname !== '/mfa' &&
    ctx.mfaEnrolled &&
    ctx.aal !== 'aal2'
  ) {
    const dest = request.nextUrl.clone()
    dest.pathname = '/mfa'
    if (pathname.startsWith('/app/')) dest.searchParams.set('next', pathname)
    return NextResponse.redirect(dest)
  }

  // Super-admin routes require the super_admin flag on the user's metadata.
  // This is a belt-and-suspenders check — the layout also verifies server-side.
  // SECURITY: trust ONLY app_metadata (privileged, service-role-only). The
  // user_metadata branch was removed because users can self-set that field.
  if (routeClass === 'super_admin') {
    const isSuperAdmin =
      ctx.appMeta?.role === 'super_admin' || ctx.appMeta?.is_super_admin === true
    if (!isSuperAdmin) {
      console.warn('[middleware] non-admin access to super-admin route:', pathname, 'user:', ctx.id)
      const dest = request.nextUrl.clone()
      dest.pathname = '/app'
      return NextResponse.redirect(dest)
    }
  }

  // Pass through — session cookie already refreshed by the Supabase client
  // (the set/remove callbacks above update supabaseResponse).
  return supabaseResponse
}
