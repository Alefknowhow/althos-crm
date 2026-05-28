import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  const response = await updateSession(request)

  // Forward the pathname as a header so server layouts can read it
  // without having to use hooks (which are client-only).
  // Used by the billing gate in app/app/[orgSlug]/layout.tsx to skip
  // the redirect when the user is already on the /upgrade page.
  response.headers.set('x-pathname', request.nextUrl.pathname)

  return response
}

export const config = {
  matcher: [
    // Exclude Next.js internals, static assets, PWA files, and common media types.
    '/((?!_next/static|_next/image|favicon\\.ico|sw\\.js|workbox-.*\\.js|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json)$).*)',
  ],
}
