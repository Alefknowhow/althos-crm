'use server'

/**
 * General org settings: name/niche, appearance, company data, revenue
 * goal. Split out of actions/organization.ts.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'


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

export async function updateOrgAppearance(
  orgSlug: string,
  payload: { logo_url?: string | null },
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

/**
 * Cor de destaque usada no link público de cotações e na vitrine de ofertas
 * (org_settings.brand_accent — hoje sem nenhuma tela pra editar, então toda
 * cotação sai com o azul padrão). Upsert porque a linha pode nem existir
 * ainda pra essa organização.
 */
export async function updateOrgBrandAccent(orgSlug: string, color: string | null) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { error } = await supabase
    .from('org_settings')
    .upsert({ org_id: org.id, brand_accent: color }, { onConflict: 'org_id' })
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/configuracoes`)
  revalidatePath(`/app/${orgSlug}/cotacoes`)
  return { ok: true as const }
}

// ─── Company data (shown in proposal header/footer) ──────────────────────────

export const COMPANY_FIELDS = [
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

// ─── Meta mensal de receita (linha de referência no gráfico da Inicial) ──────

export async function getMonthlyRevenueGoal(orgSlug: string): Promise<number | null> {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('organizations')
    .select('monthly_revenue_goal_cents')
    .eq('id', org.id)
    .maybeSingle()
  return (data?.monthly_revenue_goal_cents as number | null) ?? null
}

export async function setMonthlyRevenueGoal(orgSlug: string, cents: number | null) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { error } = await supabase
    .from('organizations')
    .update({ monthly_revenue_goal_cents: cents })
    .eq('id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/configuracoes`)
  revalidatePath(`/app/${orgSlug}`)
  return { ok: true as const }
}
