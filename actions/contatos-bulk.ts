'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization, isImpersonating } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'
import { inngest } from '@/lib/inngest/client'
import { checkContatoPermission } from './contatos-shared'

/* =========================================================
 *  Bulk lead operations, duplicate detection, search
 * ========================================================= */

export async function bulkUpdateLeads(
  orgSlug: string,
  leadIds: string[],
  updates: { stage_id?: string; addTag?: string; assigned_to?: string },
) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkContatoPermission(org.id, user.id)
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  const supabase = createClient()

  if (!leadIds.length) return { ok: true as const, count: 0 }

  const directPatch: any = {}
  if (updates.stage_id) directPatch.stage_id = updates.stage_id
  if (updates.assigned_to) directPatch.assigned_to = updates.assigned_to

  if (Object.keys(directPatch).length > 0) {
    directPatch.updated_at = new Date().toISOString()
    const { error } = await supabase
      .from('contatos')
      .update(directPatch)
      .in('id', leadIds)
      .eq('organization_id', org.id)
    if (error) return { ok: false as const, error: error.message }
  }

  if (updates.addTag) {
    const tag = updates.addTag.trim()
    if (tag) {
      const { data: rows } = await supabase
        .from('contatos')
        .select('id, tags')
        .in('id', leadIds)
        .eq('organization_id', org.id)
      for (const r of rows || []) {
        const next = Array.from(new Set([...(r.tags || []), tag]))
        await supabase.from('contatos').update({ tags: next }).eq('id', r.id).eq('organization_id', org.id)
      }
      for (const id of leadIds) {
        await inngest.send({ name: 'lead.tag_added', data: { orgId: org.id, leadId: id, tag } })
      }
    }
  }

  await supabase.from('contato_activities').insert(
    leadIds.map(leadId => ({
      contato_id: leadId,
      organization_id: org.id,
      type: 'bulk_updated',
      payload: updates,
      created_by: user.id,
    })),
  )

  revalidatePath(`/app/${orgSlug}/contatos`)
  return { ok: true as const, count: leadIds.length }
}

export async function bulkDeleteLeads(orgSlug: string, leadIds: string[]) {
  if (isImpersonating()) {
    return { ok: false as const, error: 'Ações destrutivas não são permitidas em modo de impersonação.' }
  }
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkContatoPermission(org.id, user.id)
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  const supabase = createClient()

  if (!leadIds.length) return { ok: true as const, count: 0 }

  const { error } = await supabase
    .from('contatos')
    .delete()
    .in('id', leadIds)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/contatos`)
  return { ok: true as const, count: leadIds.length }
}

export async function findDuplicateLead(
  orgSlug: string,
  payload: { email?: string; phone?: string },
) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkContatoPermission(org.id, user.id)
  if (!perm.allowed) return { match: null }
  const supabase = createClient()

  const email = (payload.email || '').trim().toLowerCase()
  const phone = (payload.phone || '').replace(/\D/g, '')

  if (!email && !phone) return { match: null }

  const filters: string[] = []
  if (email) filters.push(`email.eq.${email}`)
  if (phone) filters.push(`phone.eq.${phone}`)

  const { data } = await supabase
    .from('contatos')
    .select('id, name, email, phone')
    .eq('organization_id', org.id)
    .or(filters.join(','))
    .limit(1)
    .maybeSingle()

  return { match: data || null }
}

export async function searchLeads(orgSlug: string, query: string, limit = 20) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkContatoPermission(org.id, user.id)
  if (!perm.allowed) return []
  const supabase = createClient()

  const q = (query || '').trim()
  let builder = supabase
    .from('contatos')
    .select('id, name, email, phone')
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (q) {
    const safe = q.replace(/[%_]/g, '\\$&')
    builder = builder.or(`name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%`)
  }

  const { data, error } = await builder
  if (error) {
    console.error('searchLeads error:', error)
    return []
  }
  return data || []
}

/* =========================================================
 *  Cliente-style operations (status = 'cliente')
 *  Os campos de cadastro agora vivem direto em contatos.
 * ========================================================= */

