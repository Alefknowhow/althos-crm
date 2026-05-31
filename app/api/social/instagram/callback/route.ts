import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import {
  verifyState,
  exchangeCodeForToken,
  getLongLivedToken,
  getUserPagesWithInstagram,
  subscribePageWebhooks,
} from '@/lib/social/instagram'

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://althos-crm.vercel.app'

function back(orgSlug: string, qs: string) {
  return NextResponse.redirect(`${BASE}/app/${orgSlug}/configuracoes/social?${qs}`)
}

/**
 * OAuth callback: exchanges the code for a long-lived token, finds the Page +
 * linked Instagram business account, stores the connection, and subscribes the
 * Page to the messages/comments webhooks.
 * GET /api/social/instagram/callback?code=...&state=...
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const oauthError = searchParams.get('error_description') || searchParams.get('error')

  const parsed = state ? verifyState(state) : null
  if (!parsed) {
    return NextResponse.redirect(`${BASE}/?social_error=invalid_state`)
  }
  const { orgSlug } = parsed

  if (oauthError) {
    return back(orgSlug, `error=oauth&msg=${encodeURIComponent(oauthError)}`)
  }
  if (!code) {
    return back(orgSlug, 'error=missing_code')
  }

  try {
    // 1) code → short-lived → long-lived user token
    const shortToken = await exchangeCodeForToken(code)
    const { token: userToken } = await getLongLivedToken(shortToken)

    // 2) Pages + linked Instagram accounts
    const pages = await getUserPagesWithInstagram(userToken)
    const withIg = pages.filter(p => p.igAccountId)

    if (withIg.length === 0) {
      return back(orgSlug, 'error=no_instagram')
    }

    // 3) Resolve org id
    const admin = createAdminClient()
    const { data: org } = await admin
      .from('organizations')
      .select('id')
      .eq('slug', orgSlug)
      .maybeSingle()
    if (!org) return back(orgSlug, 'error=org_not_found')

    // 4) Upsert one connection per Instagram account (page token = page access token)
    const expiresAt = new Date(Date.now() + 55 * 24 * 3600 * 1000).toISOString() // ~55 days
    for (const p of withIg) {
      await admin
        .from('social_connections')
        .upsert(
          {
            organization_id: org.id,
            platform: 'instagram',
            page_id: p.igAccountId!,        // IG business account id (matches webhook entry.id)
            page_name: p.pageName,
            username: p.igUsername,
            access_token: p.pageAccessToken,
            token_expires_at: expiresAt,
            is_active: true,
          },
          { onConflict: 'organization_id,platform,page_id' },
        )
      // 5) Subscribe the Page to the webhook fields (best-effort).
      await subscribePageWebhooks(p.pageId, p.pageAccessToken)
    }

    return back(orgSlug, 'connected=1')
  } catch (e: any) {
    console.error('[instagram callback]', e?.message)
    return back(orgSlug, `error=exchange&msg=${encodeURIComponent(e?.message || 'erro')}`)
  }
}
