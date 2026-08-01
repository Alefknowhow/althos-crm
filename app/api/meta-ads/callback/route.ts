import { NextResponse } from 'next/server'
import {
  verifyState,
  exchangeCodeForToken,
  getLongLivedToken,
  getMetaUserProfile,
} from '@/lib/meta/ads-oauth'

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://althoscrm.com.br'
const PENDING_TOKEN_COOKIE = 'meta_ads_pending_token'
const PENDING_ORG_COOKIE = 'meta_ads_pending_org'

function back(orgSlug: string, qs: string) {
  return NextResponse.redirect(`${BASE}/app/${orgSlug}/marketing/contas?${qs}`)
}

/**
 * OAuth callback do login com Facebook (escopo ads_read). Troca o code por um
 * token de longa duração e guarda numa cookie httpOnly de curta duração (10
 * min) — o token nunca chega ao client JS. Redireciona pra tela de seleção de
 * contas, que lê a cookie no servidor e lista as contas disponíveis.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const oauthError = searchParams.get('error_description') || searchParams.get('error')

  const parsed = state ? verifyState(state) : null
  if (!parsed) {
    return NextResponse.redirect(`${BASE}/?meta_ads_error=invalid_state`)
  }
  const { orgSlug } = parsed

  if (oauthError) {
    return back(orgSlug, `error=oauth&msg=${encodeURIComponent(oauthError)}`)
  }
  if (!code) {
    return back(orgSlug, 'error=missing_code')
  }

  try {
    const { token: shortToken } = await exchangeCodeForToken(code)
    const { token: longToken } = await getLongLivedToken(shortToken)
    // Confere que o token é válido antes de seguir (falha rápido, mensagem clara).
    await getMetaUserProfile(longToken)

    const res = back(orgSlug, 'step=select')
    res.cookies.set(PENDING_TOKEN_COOKIE, longToken, {
      httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/',
    })
    res.cookies.set(PENDING_ORG_COOKIE, orgSlug, {
      httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/',
    })
    return res
  } catch (e: any) {
    console.error('[meta-ads callback]', e?.message)
    return back(orgSlug, `error=exchange&msg=${encodeURIComponent(e?.message || 'erro')}`)
  }
}
