import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateUniqueSlug } from '@/actions/organization'

/**
 * Handles the Supabase email-confirmation redirect.
 *
 * Supabase sends the user here with ?token_hash=...&type=email after they
 * click the confirmation link.  We verify the OTP, finish setting up the
 * organisation (deferred from signup), and redirect to the app.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const origin     = process.env.NEXT_PUBLIC_APP_URL ?? 'https://althos-crm.vercel.app'
  const token_hash = searchParams.get('token_hash')

  // SECURITY: only accept a known set of OTP types instead of passing the raw
  // query-string value into verifyOtp (avoids OTP-type confusion attacks).
  const ALLOWED_OTP_TYPES = ['email', 'signup', 'recovery', 'invite', 'email_change'] as const
  type OtpType = (typeof ALLOWED_OTP_TYPES)[number]
  const rawType = searchParams.get('type') ?? 'email'
  const type: OtpType = (ALLOWED_OTP_TYPES as readonly string[]).includes(rawType)
    ? (rawType as OtpType)
    : 'email'

  if (!token_hash) {
    return NextResponse.redirect(`${origin}/login?error=link_invalido`)
  }

  const supabase = createClient()

  // Exchange the token for a session
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash,
    type,
  })

  if (error || !data.user) {
    console.error('[auth/confirm] verifyOtp error:', error?.message)
    return NextResponse.redirect(`${origin}/login?error=link_expirado`)
  }

  const user = data.user

  // Guard: if org already exists (double-click / re-visit) just redirect.
  const { data: existingMembership } = await supabase
    .from('memberships')
    .select('organizations(slug)')
    .eq('user_id', user.id)
    .maybeSingle()

  const existingSlug = (existingMembership?.organizations as any)?.slug as string | undefined
  if (existingSlug) {
    return NextResponse.redirect(`${origin}/app/${existingSlug}/pipeline`)
  }

  // Create org using name stored in metadata during signup
  const name        = (user.user_metadata?.name as string | undefined) || user.email?.split('@')[0] || 'Usuário'
  const inviteToken = (user.user_metadata?.inviteToken as string | null) ?? null
  const firstName   = name.split(' ')[0]
  const orgName     = `Workspace de ${firstName}`
  const slug        = await generateUniqueSlug(orgName)

  const { error: orgError } = await supabase
    .rpc('create_organization_for_user', { org_name: orgName, org_slug: slug })
    .single()

  if (orgError) {
    console.error('[auth/confirm] create org error:', orgError.message)
    return NextResponse.redirect(`${origin}/login?error=erro_ao_criar_conta`)
  }

  // Get the fresh org ID for billing setup
  const { data: membership } = await supabase
    .from('memberships')
    .select('organization_id')
    .eq('user_id', user.id)
    .maybeSingle()

  const orgId = (membership as any)?.organization_id as string | undefined

  if (orgId) {
    if (inviteToken) {
      const { redeemInvite } = await import('@/actions/invites')
      await redeemInvite(inviteToken, orgId)
    } else {
      // Standard self-signup: 7-day trial, 50-lead limit
      const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      await supabase
        .from('organizations')
        .update({
          plan:                'trial',
          subscription_status: 'trialing',
          trial_ends_at:       trialEndsAt,
          limit_leads:         50,
        })
        .eq('id', orgId)
    }
  }

  return NextResponse.redirect(`${origin}/app/${slug}/pipeline`)
}
