import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/types'
import { buildOAuthDialogUrl, isInstagramConfigured, signState } from '@/lib/social/instagram'

/**
 * Kicks off the Instagram (Facebook Login) OAuth flow.
 * GET /api/social/instagram/connect?org=<orgSlug>
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const orgSlug = searchParams.get('org')
  if (!orgSlug) return new NextResponse('Missing org', { status: 400 })

  // Must be logged in to start a connection.
  await requireAuth()

  if (!isInstagramConfigured()) {
    // No Meta App credentials yet — bounce back to settings with a flag so the
    // page can show the setup guide instead of a broken Facebook dialog.
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://althos-crm.vercel.app'}/app/${orgSlug}/configuracoes/social?error=not_configured`,
    )
  }

  const state = signState({ orgSlug, ts: Date.now() })
  return NextResponse.redirect(buildOAuthDialogUrl(state))
}
