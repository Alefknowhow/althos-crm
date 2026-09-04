'use server'

/**
 * Perfis de rodapé/identidade salvos (marca 2ª agência).
 * Split out of actions/quotations.ts.
 */

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'

/* ─────────── perfis de rodapé/identidade salvos (marca 2ª agência) ─────────── */
export type FooterProfileRow = {
  id: string
  name: string
  legal_name: string | null
  logo_url: string | null
  address: string | null
  cnpj: string | null
  cadastur: string | null
  instagram_url: string | null
  site_url: string | null
  whatsapp_number: string | null
  phone: string | null
  email: string | null
}

const FooterProfileSchema = z.object({
  name: z.string().min(1).max(120),
  legal_name: z.string().max(160).nullable().optional(),
  logo_url: z.string().url().nullable().optional(),
  address: z.string().max(300).nullable().optional(),
  cnpj: z.string().max(40).nullable().optional(),
  cadastur: z.string().max(60).nullable().optional(),
  instagram_url: z.string().max(300).nullable().optional(),
  site_url: z.string().max(300).nullable().optional(),
  whatsapp_number: z.string().max(30).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  email: z.string().max(160).nullable().optional(),
})

export async function listFooterProfiles(orgSlug: string): Promise<FooterProfileRow[]> {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'cotacoes')
  if (!perm.allowed) return []
  const supabase = createClient()
  const { data } = await supabase
    .from('quotation_footer_profiles')
    .select('id, name, legal_name, logo_url, address, cnpj, cadastur, instagram_url, site_url, whatsapp_number, phone, email')
    .eq('organization_id', org.id)
    .order('name', { ascending: true })
  return (data as FooterProfileRow[]) ?? []
}

export async function createFooterProfile(orgSlug: string, input: unknown) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'cotacoes')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const parsed = FooterProfileSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'Dados inválidos: ' + parsed.error.issues[0]?.message }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('quotation_footer_profiles')
    .insert({ organization_id: org.id, ...parsed.data })
    .select('id').single()

  if (error) {
    if (error.code === '23505') return { ok: false as const, error: 'Já existe uma marca salva com esse nome.' }
    return { ok: false as const, error: error.message || 'Erro ao salvar a marca.' }
  }
  return { ok: true as const, id: (data as any).id }
}

export async function updateFooterProfile(orgSlug: string, id: string, input: unknown) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'cotacoes')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const parsed = FooterProfileSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'Dados inválidos: ' + parsed.error.issues[0]?.message }

  const supabase = createClient()
  const { error } = await supabase
    .from('quotation_footer_profiles')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id).eq('organization_id', org.id)

  if (error) {
    if (error.code === '23505') return { ok: false as const, error: 'Já existe uma marca salva com esse nome.' }
    return { ok: false as const, error: error.message || 'Erro ao salvar a marca.' }
  }
  return { ok: true as const }
}

export async function deleteFooterProfile(orgSlug: string, id: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'cotacoes')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  const { error } = await supabase
    .from('quotation_footer_profiles')
    .delete()
    .eq('id', id).eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message || 'Erro ao remover a marca.' }
  return { ok: true as const }
}
