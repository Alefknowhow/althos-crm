'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { slugify } from '@/lib/utils/slugify'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { traduzirErro } from '@/lib/utils/error-translator'
import { revalidatePath } from 'next/cache'
import { DEFAULT_QUALIFIER_PROMPT } from '@/lib/ai/qualifier-prompt'
import { defaultMemberPermissions } from '@/lib/permissions'


/**
 * Generates a unique slug for a new organization.
 * Uses the admin client (bypasses RLS) so it can see ALL existing slugs,
 * not just the ones the calling user belongs to. Without this, new users
 * with no orgs would always get the first try slug accepted, causing
 * duplicate-slug errors when the RPC runs against the DB constraint.
 */
export async function generateUniqueSlug(name: string) {
  const baseSlug = slugify(name)
  // Admin client bypasses RLS so we see all existing slugs globally
  const supabase = createAdminClient()
  let slug = baseSlug
  let counter = 1
  while (true) {
    const { data } = await supabase.from('organizations').select('id').eq('slug', slug).limit(1)
    if (!data || data.length === 0) {
      break
    }
    slug = `${baseSlug}-${counter}`
    counter++
  }
  return slug
}

export async function createOrganization(formData: FormData) {
  const user = await requireAuth()
  const name = (formData.get('name') as string)?.trim()

  if (!name || name.length < 2) {
    return { ok: false, error: 'Nome da organização inválido' }
  }

  const slug = await generateUniqueSlug(name)
  const admin = createAdminClient()

  // 0. Ensure the user has an account (top-level tenant grouping). Every org
  //    belongs to exactly one account; the niche lives on the account and is
  //    inherited by all its orgs. Reuse the user's existing account if any,
  //    otherwise create one (the user becomes its admin).
  let accountId: string | null = null
  let accountNiche: string | null = null
  {
    const { data: existing } = await admin
      .from('account_members')
      .select('account_id, accounts(niche)')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle()

    if (existing?.account_id) {
      accountId    = existing.account_id
      accountNiche = (existing as any).accounts?.niche ?? null
    } else {
      const { data: newAccount, error: accErr } = await admin
        .from('accounts')
        .insert({ name, owner_user_id: user.id })
        .select('id, niche')
        .single()
      if (accErr) return { ok: false, error: accErr.message }
      accountId    = newAccount.id
      accountNiche = newAccount.niche
      await admin
        .from('account_members')
        .insert({ account_id: accountId, user_id: user.id, role: 'admin' })
    }
  }

  // 1. Cria a organização (vinculada à conta + herdando o nicho da conta)
  const { data: org, error: orgError } = await admin
    .from('organizations')
    .insert({
      name,
      slug,
      account_id: accountId,
      niche: accountNiche,            // mirror of the account niche
      // New signups start on the free-forever plan. The 7-day paid trial only
      // begins at checkout (with a payment method). 'free' is never billing-blocked.
      plan: 'free',
      account_type: 'self_signup',
      subscription_status: 'active',
      trial_ends_at: null,
      limit_leads: 100,
      limit_whatsapp_monthly: 100,
      limit_email_monthly: 100,
      limit_users: 3,
      onboarding_completed: true,   // wizard is replaced by the onboarding flow
    })
    .select()
    .single()

  if (orgError) {
    return { ok: false, error: orgError.message }
  }

  // 2. Cria membership como owner
  const { error: memberError } = await admin
    .from('memberships')
    .insert({ organization_id: org.id, user_id: user.id, role: 'owner' })

  if (memberError) {
    // Org criada mas membership falhou — tenta rollback
    await admin.from('organizations').delete().eq('id', org.id)
    return { ok: false, error: memberError.message }
  }

  // 2a. Fan-out: todo usuário já presente na conta deve existir nesta nova org
  //     também (regra: "todos os usuários presentes em todas as orgs da conta").
  //     A visibilidade por org é controlada depois via memberships.hidden.
  if (accountId) {
    const { data: accUsers } = await admin
      .from('account_members')
      .select('user_id, role')
      .eq('account_id', accountId)
    for (const au of accUsers ?? []) {
      if (au.user_id === user.id) continue // já é owner desta org
      await admin.from('memberships').upsert(
        {
          organization_id: org.id,
          user_id:         au.user_id,
          role:            au.role === 'admin' ? 'admin' : 'member',
          permissions:     au.role === 'admin' ? {} : defaultMemberPermissions(),
          hidden:          false,
        },
        { onConflict: 'organization_id,user_id', ignoreDuplicates: true },
      )
    }
  }

  // 2b. Referral capture (/signup?ref=CODE). The code is bridged via a cookie
  //     set on the signup page (covers the Google OAuth flow, where the ref
  //     param can't round-trip through the provider). Best-effort.
  if (accountId) {
    const { cookies } = await import('next/headers')
    const refCode = cookies().get('althos_ref')?.value?.trim()
    if (refCode) {
      const { error: refError } = await admin.rpc('redeem_referral', {
        p_referred_account_id: accountId,
        p_code:                refCode,
      })
      if (refError) console.error('createOrganization redeem_referral error:', refError.message)
      cookies().delete('althos_ref')
    }
  }

  // 3. Cria pipeline padrão + estágios
  const { data: pipeline } = await admin
    .from('pipelines')
    .insert({ organization_id: org.id, name: 'Vendas', is_default: true })
    .select()
    .single()

  if (pipeline) {
    await admin.from('pipeline_stages').insert([
      { pipeline_id: pipeline.id, name: 'Novo Lead',     position: 1, color: '#94a3b8' },
      { pipeline_id: pipeline.id, name: 'Contato Feito', position: 2, color: '#3b82f6' },
      { pipeline_id: pipeline.id, name: 'Negociação',    position: 3, color: '#eab308' },
      { pipeline_id: pipeline.id, name: 'Fechado',       position: 4, color: '#22c55e', is_won: true },
    ])
  }

  return { ok: true as const, data: org, redirectTo: `/app/${slug}/pipeline` }
}

/**
 * Update org-level AI qualifier configuration (Bloco 2 — IA Nível 1).
 * The API key is stored plaintext for now (TODO: Supabase Vault before prod).
 * Empty string for ai_api_key means "do not change" so the form doesn't have to
 * round-trip the existing key.
 */
export async function updateOrgAI(
  orgSlug: string,
  payload: {
    ai_enabled?: boolean
    ai_api_key?: string // empty = unchanged
    ai_qualifier_model?: string
    ai_qualifier_prompt?: string
    ai_business_context?: string
  },
) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const updates: any = {}
  if (typeof payload.ai_enabled === 'boolean') updates.ai_enabled = payload.ai_enabled
  if (payload.ai_qualifier_model) updates.ai_qualifier_model = payload.ai_qualifier_model
  if (typeof payload.ai_qualifier_prompt === 'string')
    updates.ai_qualifier_prompt = payload.ai_qualifier_prompt || DEFAULT_QUALIFIER_PROMPT
  if (typeof payload.ai_business_context === 'string')
    updates.ai_business_context = payload.ai_business_context
  if (payload.ai_api_key && payload.ai_api_key.trim()) {
    updates.ai_api_key = payload.ai_api_key.trim()
  }

  if (Object.keys(updates).length === 0) return { ok: true as const }

  const { error } = await supabase.from('organizations').update(updates).eq('id', org.id)
  if (error) {
    console.error('updateOrgAI error:', error)
    return { ok: false as const, error: error.message }
  }

  revalidatePath(`/app/${orgSlug}/configuracoes`)
  return { ok: true as const }
}

/**
 * Returns the AI config for the current org WITHOUT the api key (so we never
 * leak the secret to the client).
 */
export async function getOrgAIConfig(orgSlug: string) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data } = await supabase
    .from('organizations')
    .select('ai_enabled, ai_provider, ai_qualifier_model, ai_qualifier_prompt, ai_business_context, ai_api_key')
    .eq('id', org.id)
    .maybeSingle()

  return {
    ai_enabled: data?.ai_enabled ?? false,
    ai_provider: data?.ai_provider ?? 'anthropic',
    ai_qualifier_model: data?.ai_qualifier_model ?? 'claude-haiku-4-5',
    ai_qualifier_prompt: data?.ai_qualifier_prompt ?? DEFAULT_QUALIFIER_PROMPT,
    ai_business_context: data?.ai_business_context ?? '',
    has_api_key: !!data?.ai_api_key,
  }
}

// ─── Onboarding setup ────────────────────────────────────────────────────────

export async function completeOrgSetup(
  orgSlug: string,
  data: {
    name:           string
    contact_email:  string
    contact_phone:  string
    niche:          string
    address_city:   string
    address_state:  string
    address_zip:    string
  },
) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { error } = await supabase
    .from('organizations')
    .update({ ...data, onboarding_completed: true })
    .eq('id', org.id)

  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}`, 'layout')
  return { ok: true as const }
}

// ─── General (name + niche) ──────────────────────────────────────────────────

export async function getOrgGeneral(orgSlug: string) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  // Niche now lives on the parent account. org.niche is kept as a mirror, but
  // we read the account value when available to stay authoritative.
  let niche = (org as any).niche ?? ''
  if ((org as any).account_id) {
    const { data: account } = await supabase
      .from('accounts')
      .select('niche')
      .eq('id', (org as any).account_id)
      .maybeSingle()
    if (account?.niche != null) niche = account.niche
  }
  return {
    name:  org.name ?? '',
    niche,
  }
}

/**
 * Updates the NICHE at the account level (vertical applies to every org in the
 * account) and mirrors it onto all child organizations so the existing
 * org.niche-based gating keeps working with zero churn.
 *
 * Switching to the travel niche unlocks the travel-agency tabs. Only account
 * admins can change it — enforced by RLS on `accounts` (UPDATE requires
 * get_user_admin_accounts()). The mirror write to organizations is also
 * RLS-scoped to orgs the user can access.
 */
export async function updateOrgNiche(orgSlug: string, niche: string) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const accountId = (org as any).account_id as string | null

  if (accountId) {
    // 1. Source of truth: the account.
    const { error: accErr } = await supabase
      .from('accounts')
      .update({ niche })
      .eq('id', accountId)
    if (accErr) return { ok: false as const, error: accErr.message }

    // 2. Mirror onto every org in the account (denormalized for gating).
    const { error: mirrorErr } = await supabase
      .from('organizations')
      .update({ niche })
      .eq('account_id', accountId)
    if (mirrorErr) return { ok: false as const, error: mirrorErr.message }
  } else {
    // Legacy orgs without an account: fall back to org-level write.
    const { error } = await supabase
      .from('organizations')
      .update({ niche })
      .eq('id', org.id)
    if (error) return { ok: false as const, error: error.message }
  }

  // Niche gates sidebar links + page access, so revalidate the whole app shell.
  revalidatePath(`/app/${orgSlug}`, 'layout')
  return { ok: true as const }
}

// ─── Appearance ───────────────────────────────────────────────────────────────

export async function getOrgAppearance(orgSlug: string) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('organizations')
    .select('logo_url, primary_color')
    .eq('id', org.id)
    .maybeSingle()
  return {
    logo_url:      data?.logo_url      ?? null,
    primary_color: data?.primary_color ?? null,
  }
}

export async function updateOrgAppearance(
  orgSlug: string,
  payload: { logo_url?: string | null; primary_color?: string | null },
) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { error } = await supabase
    .from('organizations')
    .update(payload)
    .eq('id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/configuracoes`)
  return { ok: true as const }
}

// ─── Company data (shown in proposal header/footer) ──────────────────────────

const COMPANY_FIELDS = [
  'cnpj', 'cadastur', 'contact_phone', 'contact_email', 'instagram', 'website',
  'address_street', 'address_city', 'address_state', 'address_zip',
] as const

export type OrgCompanyData = Record<(typeof COMPANY_FIELDS)[number], string>

export async function getOrgCompany(orgSlug: string): Promise<OrgCompanyData> {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('organizations')
    .select(COMPANY_FIELDS.join(', '))
    .eq('id', org.id)
    .maybeSingle()

  const out = {} as OrgCompanyData
  for (const f of COMPANY_FIELDS) out[f] = ((data as any)?.[f] as string) ?? ''
  return out
}

export async function updateOrgCompany(orgSlug: string, payload: Partial<OrgCompanyData>) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const updates: Record<string, string | null> = {}
  for (const f of COMPANY_FIELDS) {
    if (f in payload) {
      const v = (payload[f] ?? '').trim()
      updates[f] = v || null
    }
  }
  if (Object.keys(updates).length === 0) return { ok: true as const }

  const { error } = await supabase.from('organizations').update(updates).eq('id', org.id)
  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/configuracoes`)
  return { ok: true as const }
}

// ─── Meta / Facebook integration ─────────────────────────────────────────────

export async function getOrgMetaConfig(orgSlug: string) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data } = await supabase
    .from('organizations')
    .select('meta_pixel_id, meta_access_token')
    .eq('id', org.id)
    .maybeSingle()

  return {
    meta_pixel_id:     data?.meta_pixel_id     ?? '',
    // Never expose the token to the client — return only whether it's set
    has_access_token:  !!data?.meta_access_token,
  }
}

export async function saveOrgMetaConfig(
  orgSlug: string,
  values: { meta_pixel_id: string; meta_access_token?: string },
) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const update: any = { meta_pixel_id: values.meta_pixel_id || null }
  // Only overwrite the token if a new value was supplied (empty = keep existing)
  if (values.meta_access_token !== undefined && values.meta_access_token !== '') {
    update.meta_access_token = values.meta_access_token
  }

  const { error } = await supabase
    .from('organizations')
    .update(update)
    .eq('id', org.id)

  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/configuracoes/meta`)
  return { ok: true as const }
}

/**
 * Permanently delete an organization and all its data (cascades via FK).
 * Only an owner/admin member may do this. Refuses to delete the user's last
 * organization so they're never left without a workspace to land on.
 */
export async function deleteOrganization(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const admin = createAdminClient()

  // Authorize: caller must be owner/admin of THIS org.
  const { data: membership } = await admin
    .from('memberships')
    .select('role')
    .eq('organization_id', org.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return { ok: false as const, error: 'Apenas o proprietário pode excluir a organização.' }
  }

  // Refuse to delete the user's last remaining organization.
  const { data: myOrgs } = await admin
    .from('memberships')
    .select('organization_id')
    .eq('user_id', user.id)
  const remaining = (myOrgs ?? []).filter(m => m.organization_id !== org.id)
  if (remaining.length === 0) {
    return {
      ok: false as const,
      error: 'Não é possível excluir sua única organização. Crie outra antes.',
    }
  }

  const { error } = await admin.from('organizations').delete().eq('id', org.id)
  if (error) {
    console.error('deleteOrganization error:', error)
    return { ok: false as const, error: error.message }
  }

  // Pick another org for the user to land on.
  const { data: next } = await admin
    .from('organizations')
    .select('slug')
    .eq('id', remaining[0].organization_id)
    .maybeSingle()

  revalidatePath('/app')
  return { ok: true as const, nextSlug: next?.slug ?? null }
}
