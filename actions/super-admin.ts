'use server'

import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin, getUser } from '@/lib/supabase/types'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { resend } from '@/lib/resend'
import { slugify } from '@/lib/utils'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

export async function impersonateOrganization(orgId: string) {
  const superAdmin = await isSuperAdmin()
  if (!superAdmin) return { ok: false as const, error: 'Não autorizado' }

  const supabase = createClient()
  const user = await getUser()

  const { data: org } = await supabase
    .from('organizations')
    .select('slug')
    .eq('id', orgId)
    .single()

  if (!org) return { ok: false as const, error: 'Organização não encontrada' }

  await supabase.from('super_admin_audit_log').insert({
    super_admin_user_id: user?.id,
    action: 'impersonate_start',
    target_organization_id: orgId,
  })

  cookies().set('impersonated_org_id', orgId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 2, // 2 h
  })

  redirect(`/app/${org.slug}`)
}

export async function exitImpersonation() {
  const supabase = createClient()
  const user = await getUser()
  const impersonatedOrgId = cookies().get('impersonated_org_id')?.value

  if (impersonatedOrgId) {
    await supabase.from('super_admin_audit_log').insert({
      super_admin_user_id: user?.id,
      action: 'impersonate_end',
      target_organization_id: impersonatedOrgId,
    })
  }

  cookies().delete('impersonated_org_id')
  redirect('/super-admin')
}

// ---------------------------------------------------------------------------
// Global metrics
// ---------------------------------------------------------------------------

export type GlobalMetrics = {
  totalOrgs:        number
  activeOrgs:       number   // subscription_status = 'active'
  trialOrgs:        number
  totalLeads:       number
  totalUsers:       number   // distinct user_ids across all memberships
  newOrgsLast30:    number
}

export async function getGlobalMetrics(): Promise<GlobalMetrics> {
  if (!(await isSuperAdmin())) {
    return { totalOrgs: 0, activeOrgs: 0, trialOrgs: 0, totalLeads: 0, totalUsers: 0, newOrgsLast30: 0 }
  }

  const admin = createAdminClient()
  const ago30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [orgsRes, leadsRes, usersRes, newOrgsRes] = await Promise.all([
    admin.from('organizations').select('id, subscription_status'),
    admin.from('leads').select('id', { count: 'exact', head: true }),
    admin.from('memberships').select('user_id'),
    admin.from('organizations').select('id', { count: 'exact', head: true }).gte('created_at', ago30),
  ])

  const orgs = orgsRes.data || []
  const uniqueUsers = new Set((usersRes.data || []).map((m: any) => m.user_id))

  return {
    totalOrgs:     orgs.length,
    activeOrgs:    orgs.filter((o: any) => o.subscription_status === 'active').length,
    trialOrgs:     orgs.filter((o: any) => o.subscription_status === 'trialing' || o.subscription_status === 'no_billing').length,
    totalLeads:    leadsRes.count ?? 0,
    totalUsers:    uniqueUsers.size,
    newOrgsLast30: newOrgsRes.count ?? 0,
  }
}

// ---------------------------------------------------------------------------
// Organizations list
// ---------------------------------------------------------------------------

export type SuperAdminOrg = {
  id:                  string
  name:                string
  slug:                string
  plan:                string
  account_type:        string
  subscription_status: string
  created_at:          string
  trial_ends_at:       string | null
  limit_leads:         number | null
  limit_whatsapp_monthly: number | null
  limit_email_monthly: number | null
  limit_users:         number | null
  notes:               string | null
  leadCount:           number
  memberCount:         number
}

export async function getAllOrganizations(): Promise<SuperAdminOrg[]> {
  if (!(await isSuperAdmin())) return []

  const admin = createAdminClient()

  const { data: orgs } = await admin
    .from('organizations')
    .select(`
      id, name, slug, plan, account_type, subscription_status,
      created_at, trial_ends_at,
      limit_leads, limit_whatsapp_monthly, limit_email_monthly, limit_users,
      notes
    `)
    .order('created_at', { ascending: false })

  if (!orgs) return []

  // Fetch lead counts + member counts in parallel per org
  const withStats = await Promise.all(orgs.map(async (org) => {
    const [leadsRes, membersRes] = await Promise.all([
      admin.from('leads').select('id', { count: 'exact', head: true }).eq('organization_id', org.id),
      admin.from('memberships').select('id', { count: 'exact', head: true }).eq('organization_id', org.id),
    ])
    return {
      ...org,
      leadCount:   leadsRes.count ?? 0,
      memberCount: membersRes.count ?? 0,
    }
  }))

  return withStats
}

// ---------------------------------------------------------------------------
// Update org limits / plan
// ---------------------------------------------------------------------------

const updateOrgLimitsSchema = z.object({
  plan:                   z.string().min(1),
  subscription_status:    z.enum(['trialing', 'active', 'past_due', 'canceled', 'no_billing']),
  limit_leads:            z.coerce.number().int().min(0).nullable(),
  limit_whatsapp_monthly: z.coerce.number().int().min(0).nullable(),
  limit_email_monthly:    z.coerce.number().int().min(0).nullable(),
  limit_users:            z.coerce.number().int().min(1).nullable(),
  notes:                  z.string().max(1000).optional().nullable(),
})

export type UpdateOrgLimitsInput = z.infer<typeof updateOrgLimitsSchema>

export async function updateOrgLimits(orgId: string, raw: unknown) {
  if (!(await isSuperAdmin())) return { ok: false as const, error: 'Não autorizado' }

  const parsed = updateOrgLimitsSchema.safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message }

  const admin = createAdminClient()

  const { error } = await admin
    .from('organizations')
    .update({
      plan:                   parsed.data.plan,
      subscription_status:    parsed.data.subscription_status,
      limit_leads:            parsed.data.limit_leads,
      limit_whatsapp_monthly: parsed.data.limit_whatsapp_monthly,
      limit_email_monthly:    parsed.data.limit_email_monthly,
      limit_users:            parsed.data.limit_users,
      notes:                  parsed.data.notes ?? null,
    })
    .eq('id', orgId)

  if (error) return { ok: false as const, error: error.message }

  // Audit log
  const supabase = createClient()
  const user = await getUser()
  await supabase.from('super_admin_audit_log').insert({
    super_admin_user_id: user?.id,
    action:                 'update_limits',
    target_organization_id: orgId,
  })

  revalidatePath('/super-admin')
  return { ok: true as const }
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export type AuditLogEntry = {
  id:                     string
  action:                 string
  created_at:             string
  super_admin_user_id:    string
  super_admin_email:      string | null
  target_organization_id: string
  org_name:               string | null
  org_slug:               string | null
}

export async function getAuditLogs(limit = 100): Promise<AuditLogEntry[]> {
  if (!(await isSuperAdmin())) return []

  const admin = createAdminClient()

  const { data: logs } = await admin
    .from('super_admin_audit_log')
    .select(`
      id, action, created_at, super_admin_user_id, target_organization_id,
      organizations ( name, slug )
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!logs) return []

  // Resolve super admin emails via admin Auth API
  const uniqueAdminIds = Array.from(new Set(logs.map((l: any) => l.super_admin_user_id)))
  const emailMap = new Map<string, string>()
  for (const uid of uniqueAdminIds) {
    try {
      const { data: { user } } = await admin.auth.admin.getUserById(uid)
      if (user?.email) emailMap.set(uid, user.email)
    } catch { /* ignore */ }
  }

  return logs.map((log: any) => ({
    id:                     log.id,
    action:                 log.action,
    created_at:             log.created_at,
    super_admin_user_id:    log.super_admin_user_id,
    super_admin_email:      emailMap.get(log.super_admin_user_id) ?? null,
    target_organization_id: log.target_organization_id,
    org_name:               log.organizations?.name ?? null,
    org_slug:               log.organizations?.slug ?? null,
  }))
}

// ---------------------------------------------------------------------------
// Activate managed org
// ---------------------------------------------------------------------------

export async function activateManagedOrganization(formData: FormData) {
  const superAdmin = await isSuperAdmin()
  if (!superAdmin) return { ok: false as const, error: 'Não autorizado' }

  const name  = formData.get('name')  as string
  const email = formData.get('email') as string
  const tier  = formData.get('tier')  as string
  const notes = formData.get('notes') as string

  if (!name || !email || !tier) return { ok: false as const, error: 'Campos obrigatórios faltando' }

  const adminSupabase = createAdminClient()
  const slug = slugify(name) + '-' + Math.random().toString(36).substring(2, 6)

  const password = Math.random().toString(36).substring(2, 15)
  const { data: authUser, error: authError } = await adminSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  })

  if (authError) return { ok: false as const, error: 'Erro ao criar usuário: ' + authError.message }

  const { data: org, error: orgError } = await adminSupabase.rpc('create_organization_for_user_manual', {
    org_name:  name,
    org_slug:  slug,
    owner_id:  authUser.user.id,
    acc_type:  'althos_managed',
    tier_plan: tier,
  })

  if (orgError) return { ok: false as const, error: 'Erro ao criar organização: ' + orgError.message }

  await adminSupabase
    .from('organizations')
    .update({ notes, activated_at: new Date().toISOString() })
    .eq('id', org.id)

  const { data: linkData } = await adminSupabase.auth.admin.generateLink({ type: 'recovery', email })

  if (linkData?.properties?.action_link) {
    await resend.emails.send({
      from:    'Althos CRM <noreply@althos.io>',
      to:      email,
      subject: 'Bem-vindo ao seu novo CRM',
      html: `
        <h1>Olá, ${name}!</h1>
        <p>Sua conta no Althos CRM foi ativada.</p>
        <p>Para definir sua senha e acessar o sistema, clique no link abaixo:</p>
        <a href="${linkData.properties.action_link}">Definir Senha e Acessar</a>
      `,
    })
  }

  revalidatePath('/super-admin')
  return { ok: true as const, orgSlug: slug }
}
