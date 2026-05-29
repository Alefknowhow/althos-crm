import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * OAuth callback — handles both Google sign-in and email-based magic links.
 * Supabase redirects here with a `code` param after the provider flow.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code  = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error)}`)
  }

  if (code) {
    const supabase = createClient()
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (exchangeError) {
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(exchangeError.message)}`)
    }

    // Redirect to the user's org or onboarding
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: memberships } = await supabase
        .from('memberships')
        .select('organizations(slug)')
        .eq('user_id', user.id)
        .limit(1)

      if (memberships && memberships.length > 0) {
        const org = (memberships[0].organizations as any)
        const slug = Array.isArray(org) ? org[0]?.slug : org?.slug
        if (slug) return NextResponse.redirect(`${origin}/app/${slug}/pipeline`)
      }
      return NextResponse.redirect(`${origin}/onboarding`)
    }
  }

  return NextResponse.redirect(`${origin}/login`)
}
