'use server'

import { createClient } from '@/lib/supabase/server'
import { loginSchema, signupSchema } from '@/lib/validators/auth'
import { redirect } from 'next/navigation'
import { generateUniqueSlug } from './organization'
import { traduzirErro } from '@/lib/utils/error-translator'

export async function login(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const validation = loginSchema.safeParse({ email, password })
  if (!validation.success) {
    return { ok: false, error: validation.error.issues[0].message }
  }

  const supabase = createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error || !data.user) {
    return { ok: false, error: 'Credenciais inválidas' }
  }

  const { data: memberships } = await supabase
    .from('memberships')
    .select('organizations(slug)')
    .eq('user_id', data.user.id)
    .limit(1)

  let redirectTo = '/onboarding'
  if (memberships && memberships.length > 0) {
    // @ts-ignore
    redirectTo = `/app/${memberships[0].organizations.slug}/pipeline`
  }

  return { ok: true, redirectTo }
}

export async function signup(formData: FormData) {
  const name       = formData.get('name')  as string
  const email      = formData.get('email') as string
  const password   = formData.get('password') as string
  const inviteToken = (formData.get('inviteToken') as string | null)?.trim() || null

  const validation = signupSchema.safeParse({ name, email, password })
  if (!validation.success) {
    return { ok: false, error: validation.error.issues[0].message }
  }

  // Validate invite before touching auth (fail fast)
  if (inviteToken) {
    const { validateInvite } = await import('@/actions/invites')
    const inv = await validateInvite(inviteToken)
    if (!inv.ok) return { ok: false, error: inv.error }

    // Enforce email restriction if set
    if (inv.invite.email && inv.invite.email !== email.trim().toLowerCase()) {
      return { ok: false, error: 'Este convite é restrito a outro endereço de e-mail.' }
    }
  }

  const supabase = createClient()

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } }
  })

  if (authError || !authData.user) {
    return { ok: false, error: authError?.message || 'Erro ao criar conta' }
  }

  const firstName = name.split(' ')[0]
  const orgName   = `Workspace de ${firstName}`
  const slug      = await generateUniqueSlug(orgName)

  const { error } = await supabase
    .rpc('create_organization_for_user', { org_name: orgName, org_slug: slug })
    .single()

  if (error) {
    return { ok: false, error: traduzirErro(error) }
  }

  // Find the newly created org ID to apply billing settings
  const { data: membership } = await supabase
    .from('memberships')
    .select('organization_id')
    .eq('user_id', authData.user.id)
    .maybeSingle()

  const orgId = (membership as any)?.organization_id as string | undefined

  if (orgId) {
    if (inviteToken) {
      // Redeem invite → sets plan to agency/pro/whatever was configured
      const { redeemInvite } = await import('@/actions/invites')
      await redeemInvite(inviteToken, orgId)
    } else {
      // Standard self-signup: 7-day trial with 50-lead limit
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

  return { ok: true, redirectTo: `/app/${slug}/pipeline` }
}

export async function logout() {
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
