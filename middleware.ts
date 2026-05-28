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
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
