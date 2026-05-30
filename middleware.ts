import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  // SECURITY: overwrite any client-supplied x-pathname on the *request* before
  // it reaches updateSession (which forwards request headers to server
  // components via NextResponse.next({ request })). This both makes the value
  // readable by `headers()` in layouts AND prevents a client from spoofing the
  // header to influence the billing gate.
  request.headers.set('x-pathname', request.nextUrl.pathname)

  const response = await updateSession(request)

  // Also expose it on the response for any edge consumers.
  response.headers.set('x-pathname', request.nextUrl.pathname)

  return response
}

export const config = {
  matcher: [
    // Exclude Next.js internals, static assets, PWA files, and common media types.
    '/((?!_next/static|_next/image|favicon\\.ico|sw\\.js|workbox-.*\\.js|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json)$).*)',
  ],
}
