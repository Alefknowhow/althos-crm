import { NextResponse } from 'next/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { signState, buildOAuthDialogUrl, isMetaAdsOAuthConfigured } from '@/lib/meta/ads-oauth'

/** Inicia o login com Facebook (escopo ads_read) para a org do orgSlug informado. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const orgSlug = searchParams.get('orgSlug')
  const clientId = searchParams.get('clientId') || undefined
  if (!orgSlug) return NextResponse.json({ error: 'orgSlug obrigatório' }, { status: 400 })

  if (!isMetaAdsOAuthConfigured()) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://althoscrm.com.br'}/app/${orgSlug}/marketing/contas?error=not_configured`,
    )
  }

  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'marketing')
  if (!perm.allowed) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://althoscrm.com.br'}/app/${orgSlug}/marketing/contas?error=forbidden`,
    )
  }

  const state = signState({ orgSlug, ts: Date.now(), clientId })
  return NextResponse.redirect(buildOAuthDialogUrl(state))
}
