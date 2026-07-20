import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/types'
import { buildOAuthDialogUrl, isGoogleBusinessConfigured, signState } from '@/lib/google-business/oauth'

/**
 * Kicks off the Google Business Profile OAuth flow.
 * GET /api/google-business/connect?org=<orgSlug>
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const orgSlug = searchParams.get('org')
  if (!orgSlug) return new NextResponse('Missing org', { status: 400 })

  await requireAuth()

  if (!isGoogleBusinessConfigured()) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://althoscrm.com.br'}/app/${orgSlug}/configuracoes/google-business?error=not_configured`,
    )
  }

  const state = signState({ orgSlug, ts: Date.now() })
  return NextResponse.redirect(buildOAuthDialogUrl(state))
}
