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

export async function updateSession(request: NextRequest) {
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

  const { pathname } = request.nextUrl
  const routeClass = classifyRoute(pathname)

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

  // Super-admin routes require the super_admin flag on the user's metadata.
  // This is a belt-and-suspenders check — the layout also verifies server-side.
  if (routeClass === 'super_admin') {
    const isSuperAdmin =
      user.app_metadata?.role === 'super_admin' ||
      user.user_metadata?.is_super_admin === true
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
