import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import {
  verifyState,
  exchangeCodeForToken,
  discoverWabaAndPhone,
  subscribeAppToWaba,
  getPhoneDisplayInfo,
} from '@/lib/whatsapp/embedded-signup-oauth'

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.althoscrm.com.br'

function back(orgSlug: string, qs: string) {
  return NextResponse.redirect(`${BASE}/app/${orgSlug}/configuracoes/whatsapp?${qs}`)
}

/**
 * Callback do fluxo de WhatsApp Embedded Signup por redirecionamento (ver
 * lib/whatsapp/embedded-signup-oauth.ts pro contexto de por que não é mais
 * via popup+SDK). Depois de trocar o code, descobre a WABA/número via Graph
 * API (não depende do postMessage do popup, que nunca chegava).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const oauthError = searchParams.get('error_description') || searchParams.get('error')

  const parsed = state ? verifyState(state) : null
  if (!parsed) {
    return NextResponse.redirect(`${BASE}/?whatsapp_error=invalid_state`)
  }
  const { orgSlug } = parsed

  if (oauthError) {
    return back(orgSlug, `error=oauth&msg=${encodeURIComponent(oauthError)}`)
  }
  if (!code) {
    return back(orgSlug, 'error=missing_code')
  }

  try {
    const accessToken = await exchangeCodeForToken(code)
    const { wabaId, phoneNumberId } = await discoverWabaAndPhone(accessToken)
    await subscribeAppToWaba(wabaId, accessToken)
    const { displayPhone, verifiedName } = await getPhoneDisplayInfo(phoneNumberId, accessToken)

    const supabase = createAdminClient()
    const { data: org } = await supabase.from('organizations').select('id').eq('slug', orgSlug).maybeSingle()
    if (!org) return back(orgSlug, 'error=org_not_found')

    const { error } = await supabase
      .from('organizations')
      .update({
        whatsapp_phone_number_id: phoneNumberId,
        whatsapp_access_token: accessToken,
        whatsapp_display_phone: displayPhone && verifiedName ? `${verifiedName} — ${displayPhone}` : displayPhone,
      })
      .eq('id', org.id)
    if (error) throw new Error(error.message)

    return back(orgSlug, 'success=1')
  } catch (e: any) {
    console.error('[whatsapp embedded-signup callback]', e?.message)
    return back(orgSlug, `error=exchange&msg=${encodeURIComponent(e?.message || 'erro')}`)
  }
}
