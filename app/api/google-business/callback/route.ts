import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import {
  verifyState, exchangeCodeForTokens, listGoogleBusinessAccounts,
} from '@/lib/google-business/oauth'

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://althoscrm.com.br'

function back(orgSlug: string, qs: string) {
  return NextResponse.redirect(`${BASE}/app/${orgSlug}/configuracoes/google-business?${qs}`)
}

/**
 * OAuth callback: exchanges the code for tokens, resolves the Google Business
 * account(s) the user granted access to, and stores one connection per
 * account. Location selection happens afterwards, from the settings page
 * (an account can have many locations/units).
 * GET /api/google-business/callback?code=...&state=...
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const oauthError = searchParams.get('error')

  const parsed = state ? verifyState(state) : null
  if (!parsed) {
    return NextResponse.redirect(`${BASE}/?gbp_error=invalid_state`)
  }
  const { orgSlug } = parsed

  if (oauthError) {
    return back(orgSlug, `error=oauth&msg=${encodeURIComponent(oauthError)}`)
  }
  if (!code) {
    return back(orgSlug, 'error=missing_code')
  }

  try {
    const { accessToken, refreshToken, expiresIn } = await exchangeCodeForTokens(code)
    const accounts = await listGoogleBusinessAccounts(accessToken)
    if (accounts.length === 0) {
      return back(orgSlug, 'error=no_account')
    }

    const admin = createAdminClient()
    const { data: org } = await admin
      .from('organizations')
      .select('id')
      .eq('slug', orgSlug)
      .maybeSingle()
    if (!org) return back(orgSlug, 'error=org_not_found')

    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

    // A user may grant access to multiple Business accounts in one consent —
    // store a connection row per account; location picking happens later.
    for (const account of accounts) {
      await admin
        .from('google_business_connections')
        .upsert(
          {
            organization_id: org.id,
            google_account_id: account.name,
            account_name: account.accountName,
            refresh_token: refreshToken,
            access_token: accessToken,
            token_expires_at: expiresAt,
            is_active: true,
          },
          { onConflict: 'organization_id,google_account_id' },
        )
    }

    return back(orgSlug, 'connected=1')
  } catch (e: any) {
    console.error('[google-business callback]', e?.message)
    return back(orgSlug, `error=exchange&msg=${encodeURIComponent(e?.message || 'erro')}`)
  }
}
