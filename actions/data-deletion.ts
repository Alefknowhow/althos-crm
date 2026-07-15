'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'

/**
 * Solicitações de exclusão de dados (exigência da Meta — Data Deletion
 * Instructions URL). Página pública recebe o pedido (sem sessão); a fila de
 * revisão vive dentro do CRM da organização casada pelo @ do Instagram.
 */

export type DataDeletionRequest = {
  id: string
  business_username: string
  requester_name: string | null
  requester_contact: string | null
  message: string | null
  status: 'pending' | 'resolved'
  created_at: string
  resolved_at: string | null
}

const SubmitSchema = z.object({
  business_username: z.string().trim().min(1).max(60),
  requester_name: z.string().trim().max(120).optional(),
  requester_contact: z.string().trim().max(200).optional(),
  message: z.string().trim().max(2000).optional(),
})

// Instagram usernames only use letters, digits, dots and underscores — strip
// anything else so the value is safe to interpolate into a PostgREST .or() filter.
function normalizeHandle(v: string): string {
  return v.trim().replace(/^@/, '').toLowerCase().replace(/[^a-z0-9._]/g, '')
}

/** Rota pública — sem auth. Tenta casar a organização pelo @ do Instagram
 *  informado; se não achar (ou achar mais de uma), o pedido fica sem
 *  organização para triagem manual, mas é registrado do mesmo jeito. */
export async function submitDataDeletionRequest(payload: unknown) {
  const parsed = SubmitSchema.safeParse(payload)
  if (!parsed.success) return { ok: false as const, error: 'Preencha o @ do Instagram da empresa que você contatou.' }

  const admin = createAdminClient()
  const handle = normalizeHandle(parsed.data.business_username)

  let organizationId: string | null = null
  if (handle) {
    const { data: matches } = await admin
      .from('social_connections')
      .select('organization_id, username, page_name')
      .eq('platform', 'instagram')
      .or(`username.ilike.${handle},page_name.ilike.${handle}`)

    const uniqueOrgIds = Array.from(new Set((matches || []).map(m => m.organization_id)))
    organizationId = uniqueOrgIds.length === 1 ? uniqueOrgIds[0] : null
  }

  const { data, error } = await admin
    .from('data_deletion_requests')
    .insert({
      organization_id: organizationId,
      platform: 'instagram',
      business_username: parsed.data.business_username.trim(),
      requester_name: parsed.data.requester_name || null,
      requester_contact: parsed.data.requester_contact || null,
      message: parsed.data.message || null,
    })
    .select('id')
    .single()

  if (error || !data) return { ok: false as const, error: 'Não foi possível registrar o pedido. Tente novamente.' }
  return { ok: true as const, protocol: data.id as string }
}

async function guard(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'social')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  return { ok: true as const, org, userId: user.id }
}

export async function listDataDeletionRequests(orgSlug: string): Promise<DataDeletionRequest[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('data_deletion_requests')
    .select('id, business_username, requester_name, requester_contact, message, status, created_at, resolved_at')
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })
  return (data as DataDeletionRequest[] | null) || []
}

export async function resolveDataDeletionRequest(orgSlug: string, id: string) {
  const g = await guard(orgSlug)
  if (!g.ok) return g
  const supabase = createClient()
  const { error } = await supabase
    .from('data_deletion_requests')
    .update({ status: 'resolved', resolved_at: new Date().toISOString(), resolved_by: g.userId })
    .eq('id', id)
    .eq('organization_id', g.org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/configuracoes/social`)
  return { ok: true as const }
}
