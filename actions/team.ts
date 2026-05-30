'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'
import { getResend } from '@/lib/resend'
import { type Permissions, allPermissions, defaultMemberPermissions } from '@/lib/permissions'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://althos-crm.vercel.app'

// ── Types ─────────────────────────────────────────────────────────────────────

export type TeamMember = {
  membership_id: string
  user_id:       string
  email:         string
  name:          string
  role:          string
  permissions:   Permissions
  joined_at:     string
}

export type PendingInvitation = {
  id:         string
  email:      string
  role:       string
  permissions: Permissions
  created_at: string
  expires_at: string
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getTeamData(orgSlug: string) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const admin = createAdminClient()

  // Members: join memberships → auth.users via admin so we get name/email
  const { data: memberships } = await admin
    .from('memberships')
    .select('id, user_id, role, permissions, created_at')
    .eq('organization_id', org.id)
    .order('created_at', { ascending: true })

  // Fetch user metadata for each member
  const members: TeamMember[] = []
  for (const m of memberships ?? []) {
    const { data: { user } } = await admin.auth.admin.getUserById(m.user_id)
    members.push({
      membership_id: m.id,
      user_id:       m.user_id,
      email:         user?.email ?? '',
      name:          (user?.user_metadata?.name as string) ?? '',
      role:          m.role,
      permissions:   (m.permissions ?? {}) as Permissions,
      joined_at:     m.created_at,
    })
  }

  // Pending invitations
  const { data: invitations } = await admin
    .from('invitations')
    .select('id, email, role, permissions, created_at, expires_at')
    .eq('organization_id', org.id)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  return {
    members,
    invitations: (invitations ?? []) as PendingInvitation[],
    limit_users: (org as any).limit_users ?? 1,
    org_id:      org.id,
  }
}

// ── Invite ────────────────────────────────────────────────────────────────────

export async function inviteTeamMember(
  orgSlug:     string,
  email:       string,
  role:        'admin' | 'member',
  permissions: Permissions,
) {
  const user = await requireAuth()
  const org  = await getCurrentOrganization(orgSlug)
  const admin = createAdminClient()

  // Check plan limit
  const { count: memberCount } = await admin
    .from('memberships')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', org.id)

  const { count: inviteCount } = await admin
    .from('invitations')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', org.id)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())

  const limit = (org as any).limit_users ?? 1
  const total = (memberCount ?? 0) + (inviteCount ?? 0)
  if (total >= limit) {
    return { ok: false as const, error: `Limite de ${limit} usuários atingido no plano atual.` }
  }

  // Prevent inviting existing members
  const { data: existing } = await admin
    .auth.admin.listUsers()
  const existingUser = existing?.users?.find(u => u.email === email.toLowerCase().trim())
  if (existingUser) {
    const { data: existingMembership } = await admin
      .from('memberships')
      .select('id')
      .eq('organization_id', org.id)
      .eq('user_id', existingUser.id)
      .maybeSingle()
    if (existingMembership) {
      return { ok: false as const, error: 'Este usuário já é membro da organização.' }
    }
  }

  // Upsert invitation (replace if already pending)
  const { data: inv, error } = await admin
    .from('invitations')
    .upsert(
      {
        organization_id: org.id,
        invited_by:      user.id,
        email:           email.toLowerCase().trim(),
        role,
        permissions:     role === 'admin' ? allPermissions() : permissions,
        expires_at:      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        accepted_at:     null,
      },
      { onConflict: 'organization_id,email', ignoreDuplicates: false },
    )
    .select('token')
    .single()

  if (error || !inv) {
    return { ok: false as const, error: error?.message ?? 'Erro ao criar convite.' }
  }

  // Send email
  try {
    const inviteUrl = `${APP_URL}/convite/${inv.token}`
    const orgName   = (org as any).name ?? orgSlug
    await getResend().emails.send({
      from:    'Althos CRM <noreply@althos.com.br>',
      to:      email,
      subject: `Você foi convidado para ${orgName} no Althos CRM`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
          <h1 style="font-size:22px;font-weight:800;margin-bottom:8px">Althos CRM</h1>
          <p style="color:#6b7280;margin-bottom:24px">Convite para colaborar</p>
          <p>Você foi convidado para acessar o workspace <strong>${orgName}</strong> no Althos CRM como <strong>${role === 'admin' ? 'Administrador' : 'Membro'}</strong>.</p>
          <a href="${inviteUrl}"
             style="display:inline-block;margin-top:20px;padding:12px 28px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
            Aceitar convite
          </a>
          <p style="margin-top:24px;font-size:12px;color:#9ca3af;">
            Este link expira em 7 dias. Se você não esperava este convite, pode ignorar este e-mail.
          </p>
        </div>
      `,
    })
  } catch (e) {
    // Email failure is non-fatal — the invite was created
    console.error('invite email error:', e)
  }

  revalidatePath(`/app/${orgSlug}/configuracoes/equipe`)
  return { ok: true as const }
}

// ── Update member permissions ─────────────────────────────────────────────────

export async function updateMemberPermissions(
  orgSlug:      string,
  membershipId: string,
  permissions:  Permissions,
  role?:        'admin' | 'member',
) {
  await requireAuth()
  const org   = await getCurrentOrganization(orgSlug)
  const admin = createAdminClient()

  const update: any = { permissions }
  if (role) update.role = role

  const { error } = await admin
    .from('memberships')
    .update(update)
    .eq('id', membershipId)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/configuracoes/equipe`)
  return { ok: true as const }
}

// ── Remove member ─────────────────────────────────────────────────────────────

export async function removeMember(orgSlug: string, membershipId: string) {
  await requireAuth()
  const org   = await getCurrentOrganization(orgSlug)
  const admin = createAdminClient()

  // Prevent removing the owner
  const { data: m } = await admin
    .from('memberships')
    .select('role')
    .eq('id', membershipId)
    .eq('organization_id', org.id)
    .maybeSingle()

  if (m?.role === 'owner') {
    return { ok: false as const, error: 'O proprietário não pode ser removido.' }
  }

  const { error } = await admin
    .from('memberships')
    .delete()
    .eq('id', membershipId)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/configuracoes/equipe`)
  return { ok: true as const }
}

// ── Cancel invitation ─────────────────────────────────────────────────────────

export async function cancelInvitation(orgSlug: string, invitationId: string) {
  await requireAuth()
  const org   = await getCurrentOrganization(orgSlug)
  const admin = createAdminClient()

  const { error } = await admin
    .from('invitations')
    .delete()
    .eq('id', invitationId)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/configuracoes/equipe`)
  return { ok: true as const }
}

// ── Accept invitation (called from /convite/[token]) ──────────────────────────

export async function acceptInvitation(token: string) {
  const supabase = createClient()
  const admin    = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: 'Você precisa estar logado para aceitar o convite.' }

  // Fetch invitation by token (use admin to bypass RLS)
  const { data: inv } = await admin
    .from('invitations')
    .select('*')
    .eq('token', token)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (!inv) return { ok: false as const, error: 'Convite inválido ou expirado.' }

  // Check email matches (case-insensitive)
  if (inv.email.toLowerCase() !== (user.email ?? '').toLowerCase()) {
    return {
      ok:    false as const,
      error: `Este convite foi enviado para ${inv.email}. Faça login com esse e-mail para aceitar.`,
    }
  }

  // Check user isn't already a member
  const { data: existing } = await admin
    .from('memberships')
    .select('id')
    .eq('organization_id', inv.organization_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    // Already a member — just mark accepted & redirect
    await admin.from('invitations').update({ accepted_at: new Date().toISOString() }).eq('id', inv.id)
    const { data: org } = await admin.from('organizations').select('slug').eq('id', inv.organization_id).single()
    return { ok: true as const, redirectTo: `/app/${org?.slug}/pipeline` }
  }

  // Create membership
  const { error: memberError } = await admin.from('memberships').insert({
    organization_id: inv.organization_id,
    user_id:         user.id,
    role:            inv.role,
    permissions:     inv.permissions,
  })

  if (memberError) return { ok: false as const, error: memberError.message }

  // Mark invitation as accepted
  await admin.from('invitations').update({ accepted_at: new Date().toISOString() }).eq('id', inv.id)

  // Get org slug for redirect
  const { data: org } = await admin
    .from('organizations')
    .select('slug')
    .eq('id', inv.organization_id)
    .single()

  return { ok: true as const, redirectTo: `/app/${org?.slug}/pipeline` }
}

// ── Get invitation info (for the acceptance page) ─────────────────────────────

export async function getInvitationInfo(token: string) {
  const admin = createAdminClient()

  const { data: inv } = await admin
    .from('invitations')
    .select('email, role, organization_id, expires_at, accepted_at')
    .eq('token', token)
    .maybeSingle()

  if (!inv) return null

  const { data: org } = await admin
    .from('organizations')
    .select('name, slug')
    .eq('id', inv.organization_id)
    .single()

  const expired   = new Date(inv.expires_at) < new Date()
  const accepted  = !!inv.accepted_at

  return {
    email:    inv.email,
    role:     inv.role as 'admin' | 'member',
    orgName:  org?.name ?? '',
    orgSlug:  org?.slug ?? '',
    expired,
    accepted,
  }
}
