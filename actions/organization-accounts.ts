'use server'

/**
 * Account-level organization management: list orgs under an account,
 * rename, update company data by org id. Split out of
 * actions/organization.ts.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'
import { COMPANY_FIELDS, type OrgCompanyData } from '@/lib/organization/company-fields'

// ─── Account-level organization management ───────────────────────────────────

/** True if `userId` is the account owner or an account admin. */
async function isAccountManager(
  admin: ReturnType<typeof createAdminClient>,
  accountId: string,
  userId: string,
): Promise<boolean> {
  const { data: acc } = await admin
    .from('accounts')
    .select('owner_user_id')
    .eq('id', accountId)
    .maybeSingle()
  if (acc?.owner_user_id === userId) return true
  const { data: am } = await admin
    .from('account_members')
    .select('role')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .maybeSingle()
  return am?.role === 'admin'
}

export type ManagedOrganization = {
  id:      string
  name:    string
  slug:    string
  niche:   string | null
  company: OrgCompanyData
}

/**
 * Lists every organization in the current account, each with its company data
 * (used by the Organizações management tab). Account managers only.
 */
export async function getAccountOrganizations(orgSlug: string): Promise<ManagedOrganization[]> {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const admin = createAdminClient()
  const accountId = ((org as any).account_id as string | null) ?? null

  // Resolve the target org set (account orgs, or just this one for legacy orgs).
  const fields = ['id', 'name', 'slug', 'niche', ...COMPANY_FIELDS].join(', ')
  let rows: any[] = []
  if (accountId) {
    if (!(await isAccountManager(admin, accountId, user.id))) return []
    const { data } = await admin
      .from('organizations')
      .select(fields)
      .eq('account_id', accountId)
      .order('created_at', { ascending: true })
    rows = data ?? []
  } else {
    const { data } = await admin
      .from('organizations')
      .select(fields)
      .eq('id', org.id)
    rows = data ?? []
  }

  return rows.map(r => {
    const company = {} as OrgCompanyData
    for (const f of COMPANY_FIELDS) company[f] = (r[f] as string) ?? ''
    return { id: r.id as string, name: (r.name as string) ?? '', slug: (r.slug as string) ?? '', niche: (r.niche as string | null) ?? null, company }
  })
}

/** Renames an organization in the current account (account managers only). */
export async function renameOrganization(orgSlug: string, targetOrgId: string, name: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const admin = createAdminClient()
  const accountId = ((org as any).account_id as string | null) ?? null

  const clean = name.trim()
  if (clean.length < 2) return { ok: false as const, error: 'Nome inválido.' }

  if (accountId) {
    if (!(await isAccountManager(admin, accountId, user.id))) {
      return { ok: false as const, error: 'Apenas administradores da conta podem editar organizações.' }
    }
    const { data: target } = await admin
      .from('organizations').select('id, account_id').eq('id', targetOrgId).maybeSingle()
    if (!target || target.account_id !== accountId) {
      return { ok: false as const, error: 'Organização inválida.' }
    }
  } else if (targetOrgId !== org.id) {
    return { ok: false as const, error: 'Organização inválida.' }
  }

  const { error } = await admin.from('organizations').update({ name: clean }).eq('id', targetOrgId)
  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/configuracoes/organizacoes`, 'layout')
  return { ok: true as const }
}

/**
 * Updates company data for a SPECIFIC org of the account (Organizações tab).
 * Unlike updateOrgCompany (current org only), this targets any org the caller
 * manages within the account.
 */
export async function updateOrgCompanyById(
  orgSlug: string,
  targetOrgId: string,
  payload: Partial<OrgCompanyData>,
) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const admin = createAdminClient()
  const accountId = ((org as any).account_id as string | null) ?? null

  if (accountId) {
    if (!(await isAccountManager(admin, accountId, user.id))) {
      return { ok: false as const, error: 'Apenas administradores da conta podem editar organizações.' }
    }
    const { data: target } = await admin
      .from('organizations').select('id, account_id').eq('id', targetOrgId).maybeSingle()
    if (!target || target.account_id !== accountId) {
      return { ok: false as const, error: 'Organização inválida.' }
    }
  } else if (targetOrgId !== org.id) {
    return { ok: false as const, error: 'Organização inválida.' }
  }

  const updates: Record<string, string | null> = {}
  for (const f of COMPANY_FIELDS) {
    if (f in payload) {
      const v = (payload[f] ?? '').trim()
      updates[f] = v || null
    }
  }
  if (Object.keys(updates).length === 0) return { ok: true as const }

  const { error } = await admin.from('organizations').update(updates).eq('id', targetOrgId)
  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/configuracoes/organizacoes`)
  return { ok: true as const }
}
