'use server'

import { createClient } from '@/lib/supabase/server'
import { loginSchema, signupSchema } from '@/lib/validators/auth'
import { redirect } from 'next/navigation'

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

  // The embedded `organizations` relation comes back as an object (or array,
  // depending on the inferred FK cardinality) — normalise both shapes.
  let redirectTo = '/onboarding'
  const firstOrg = memberships?.[0]?.organizations as
    | { slug: string }
    | { slug: string }[]
    | null
    | undefined
  const slug = Array.isArray(firstOrg) ? firstOrg[0]?.slug : firstOrg?.slug
  if (slug) {
    redirectTo = `/app/${slug}/pipeline`
  }

  return { ok: true, redirectTo }
}

export async function signup(formData: FormData) {
  const name       = formData.get('name')  as string
  const email      = formData.get('email') as string
  const password   = formData.get('password') as string
  const inviteToken = (formData.get('inviteToken') as string | null)?.trim() || null
  const refCode     = (formData.get('refCode') as string | null)?.trim() || null

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
    options: {
      // Store name + inviteToken in metadata so the confirm route can
      // finish org setup after the user clicks the email link.
      data: { name, inviteToken: inviteToken ?? null, refCode: refCode ?? null },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://althoscrm.com.br'}/auth/confirm`,
    },
  })

  if (authError || !authData.user) {
    return { ok: false, error: authError?.message || 'Erro ao criar conta' }
  }

  // Org creation is deferred to /auth/confirm (after email verification).
  return { ok: true, redirectTo: '/verify-email' }
}

export async function resendConfirmationEmail(email: string) {
  const supabase = createClient()
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://althoscrm.com.br'}/auth/confirm`,
    },
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function requestPasswordReset(email: string) {
  const supabase = createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://althoscrm.com.br'}/auth/reset-password`,
  })
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}

export async function updatePassword(newPassword: string) {
  const supabase = createClient()
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}

export async function logout() {
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
