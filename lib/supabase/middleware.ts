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
 * Read the `aal` (authenticator assurance level) claim from a JWT access token
 * without any network call. Returns 'aal1' | 'aal2' | null. Edge-runtime safe
 * (uses atob, not Buffer).
 */
function readAalClaim(token: string): string | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(b64)) as { aal?: string }
    return payload.aal ?? null
  } catch {
    return null
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

  // getUser() validates the JWT server-side — more reliable than getSession()
  // which trusts the cookie value without revalidation.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  // Log suspicious Supabase auth errors (not "not logged in" 401s, those are
  // normal, but unexpected 5xx or malformed token errors are worth knowing).
  if (authError && authError.status && authError.status >= 500) {
    console.error('[middleware] Supabase auth error:', authError.message)
  }

  // ---- Not authenticated ----
  if (!user) {
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
    dest.pathname = user.email_confirmed_at ? '/onboarding' : '/verify-email'
    return NextResponse.redirect(dest)
  }

  // Block authenticated-but-unconfirmed users from accessing app routes.
  if (!user.email_confirmed_at && routeClass === 'authenticated') {
    const dest = request.nextUrl.clone()
    dest.pathname = '/verify-email'
    return NextResponse.redirect(dest)
  }

  // ---- Two-factor (MFA) enforcement ----
  // If the user has a verified MFA factor but the current session is still at
  // assurance level aal1 (password only), force them through the /mfa challenge
  // before any authenticated route. The /mfa page itself is exempt to avoid a
  // redirect loop. currentLevel is read locally from the access token's `aal`
  // claim (no extra network round-trip); verified factors come from the already
  // fetched user object.
  if (
    (routeClass === 'authenticated' || routeClass === 'super_admin') &&
    pathname !== '/mfa'
  ) {
    const hasVerifiedFactor = (user.factors ?? []).some(f => f.status === 'verified')
    if (hasVerifiedFactor) {
      const { data: { session } } = await supabase.auth.getSession()
      const currentLevel = session?.access_token ? readAalClaim(session.access_token) : null
      if (currentLevel !== 'aal2') {
        const dest = request.nextUrl.clone()
        dest.pathname = '/mfa'
        if (pathname.startsWith('/app/')) dest.searchParams.set('next', pathname)
        return NextResponse.redirect(dest)
      }
    }
  }

  // Super-admin routes require the super_admin flag on the user's metadata.
  // This is a belt-and-suspenders check — the layout also verifies server-side.
  // SECURITY: trust ONLY app_metadata (privileged, service-role-only). The
  // user_metadata branch was removed because users can self-set that field.
  if (routeClass === 'super_admin') {
    const appMeta = user.app_metadata as { role?: string; is_super_admin?: boolean } | undefined
    const isSuperAdmin =
      appMeta?.role === 'super_admin' || appMeta?.is_super_admin === true
    if (!isSuperAdmin) {
      console.warn('[middleware] non-admin access to super-admin route:', pathname, 'user:', user.id)
      const dest = request.nextUrl.clone()
      dest.pathname = '/app'
      return NextResponse.redirect(dest)
    }
  }

  // Pass through — session cookie already refreshed by the Supabase client
  // (the set/remove callbacks above update supabaseResponse).
  return supabaseResponse
}
