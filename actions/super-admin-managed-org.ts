'use server'

/**
 * Activating a managed (agency-created) organization, and per-org usage.
 * Split out of actions/super-admin.ts.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/supabase/types'
import { resend, EMAIL_FROM } from '@/lib/resend'
import { slugify } from '@/lib/utils'
import { revalidatePath } from 'next/cache'

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
      from:    EMAIL_FROM,
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

// ---------------------------------------------------------------------------
// Org usage detail (reads get_org_usage RPC)
// ---------------------------------------------------------------------------

export type OrgUsage = {
  org_id:     string
  account_id: string | null
  plan:       string
  status:     string
  period:     string
  usage:  { leads_total: number; leads_month: number; members: number; whatsapp_month: number; email_month: number; tasks_open: number }
  limits: { leads: number | null; whatsapp_monthly: number | null; email_monthly: number | null; users: number | null }
  ai_credits: { included: number; purchased: number; used: number; remaining: number; period: string }
}

export async function getOrgUsage(orgId: string): Promise<OrgUsage | null> {
  if (!(await isSuperAdmin())) return null
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('get_org_usage', { p_org_id: orgId })
  if (error || !data) return null
  return data as OrgUsage
}

// ---------------------------------------------------------------------------
// Users management
// ---------------------------------------------------------------------------

export type PlatformUserAccount = { id: string; name: string; role: string }

export type PlatformUser = {
  id:              string
  email:           string | null
  full_name:       string | null
  created_at:      string
  last_sign_in_at: string | null
  is_super_admin:  boolean
  accounts:        PlatformUserAccount[]
  org_count:       number
}

