'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization, isImpersonating } from '@/lib/supabase/types'
import { leadSchema } from '@/lib/validators/lead'
import { revalidatePath } from 'next/cache'
import { canCreateLead } from '@/lib/billing/limits'

export async function createLead(orgSlug: string, formData: FormData) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  
  if (!(await canCreateLead(org.id))) {
    return { ok: false, error: 'Limite de leads atingido para o seu plano.' }
  }

  const supabase = createClient()

  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const phone = formData.get('phone') as string
  let stage_id = formData.get('stage_id') as string
  const value_cents_str = formData.get('value_cents') as string
  const value_cents = value_cents_str ? parseInt(value_cents_str, 10) : 0
  const tags_str = formData.get('tags') as string
  const tags = tags_str ? tags_str.split(',').map(t => t.trim()).filter(Boolean) : []

  if (!stage_id) {
    const { data: pipeline } = await supabase.from('pipelines').select('id').eq('organization_id', org.id).eq('is_default', true).maybeSingle()
    if (pipeline) {
      const { data: stage } = await supabase.from('pipeline_stages').select('id').eq('pipeline_id', pipeline.id).order('position').limit(1).maybeSingle()
      if (stage) stage_id = stage.id
    }
  }

  const validation = leadSchema.safeParse({ name, email, phone, stage_id, value_cents, tags })
  if (!validation.success) {
    return { ok: false, error: validation.error.issues[0].message }
  }

  // Org has no pipeline/stage configured yet — surface a usable message instead
  // of crashing on the .eq('id', undefined) call below.
  if (!stage_id) {
    return { ok: false, error: 'Configure um pipeline com pelo menos um estágio antes de criar leads.' }
  }

  const { data: stageInfo } = await supabase
    .from('pipeline_stages')
    .select('pipeline_id')
    .eq('id', stage_id)
    .maybeSingle()

  const { data: lead, error } = await supabase.from('leads').insert({
    organization_id: org.id,
    pipeline_id: stageInfo?.pipeline_id,
    stage_id,
    name,
    email: email || null,
    phone: phone || null,
    value_cents,
    tags,
    assigned_to: user.id
  }).select().single()

  if (error || !lead) {
    // Bubble up the real DB error (RLS denial, FK violation, etc.) instead of
    // a generic message — the user reported a silent failure on save.
    return { ok: false, error: error?.message || 'Erro ao criar lead' }
  }

  await supabase.from('lead_activities').insert({
    lead_id: lead.id,
    organization_id: org.id,
    type: 'manual_created',
    payload: {},
    created_by: user.id
  })

  revalidatePath(`/app/${orgSlug}/leads`)
  return { ok: true, lead }
}

export async function addLeadNote(orgSlug: string, leadId: string, formData: FormData) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  
  const text = formData.get('text') as string
  if (!text || text.trim() === '') return { ok: false, error: 'Nota vazia' }

  const { error } = await supabase.from('lead_activities').insert({
    lead_id: leadId,
    organization_id: org.id,
    type: 'note',
    payload: { text },
    created_by: user.id
  })

  if (error) return { ok: false, error: error.message }
  
  revalidatePath(`/app/${orgSlug}/leads/${leadId}`)
  return { ok: true }
}

import { inngest } from '@/lib/inngest/client'

export async function updateLead(orgSlug: string, leadId: string, formData: FormData) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  
  const { data: oldLead } = await supabase.from('leads').select('tags').eq('id', leadId).maybeSingle()
  
  const updates: any = {}
  const name = formData.get('name') as string
  if (name) updates.name = name
  const email = formData.get('email') as string
  if (email !== null) updates.email = email || null
  const phone = formData.get('phone') as string
  if (phone !== null) updates.phone = phone || null
  
  let newTagsAdded: string[] = []
  const tags_str = formData.get('tags') as string
  if (tags_str !== null) {
    const newTags = tags_str ? tags_str.split(',').map(t => t.trim()).filter(Boolean) : []
    updates.tags = newTags
    
    const oldTags = oldLead?.tags || []
    newTagsAdded = newTags.filter(t => !oldTags.includes(t))
  }
  
  const stage_id = formData.get('stage_id') as string
  if (stage_id) updates.stage_id = stage_id

  const { error } = await supabase.from('leads').update(updates).eq('id', leadId).eq('organization_id', org.id)
  
  if (error) return { ok: false, error: error.message }
  
  for (const tag of newTagsAdded) {
    await inngest.send({
      name: 'lead.tag_added',
      data: { orgId: org.id, leadId, tag }
    })
  }
  
  revalidatePath(`/app/${orgSlug}/leads/${leadId}`)
  revalidatePath(`/app/${orgSlug}/leads`)
  return { ok: true }
}

export async function deleteLead(orgSlug: string, leadId: string) {
  if (isImpersonating()) {
    return { ok: false, error: 'Ações destrutivas não são permitidas em modo de impersonação.' }
  }
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  
  const { error } = await supabase.from('leads').delete().eq('id', leadId).eq('organization_id', org.id)
  if (error) return { ok: false, error: error.message }
  
  revalidatePath(`/app/${orgSlug}/leads`)
  return { ok: true }
}

export async function moveLeadToStage(orgSlug: string, leadId: string, newStageId: string, oldStageId: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  if (newStageId === oldStageId) return { ok: true }

  // Fetch stage flags + lead value before the update so we can fire CAPI
  const [{ data: stage }, { data: lead }] = await Promise.all([
    supabase
      .from('pipeline_stages')
      .select('is_won, is_lost')
      .eq('id', newStageId)
      .maybeSingle(),
    supabase
      .from('leads')
      .select('name, email, phone, value_cents')
      .eq('id', leadId)
      .eq('organization_id', org.id)
      .maybeSingle(),
  ])

  const { error } = await supabase
    .from('leads')
    .update({ stage_id: newStageId, updated_at: new Date().toISOString() })
    .eq('id', leadId)
    .eq('organization_id', org.id)

  if (error) return { ok: false, error: error.message }

  await supabase.from('lead_activities').insert({
    lead_id: leadId,
    organization_id: org.id,
    type: 'stage_changed',
    payload: { from: oldStageId, to: newStageId },
    created_by: user.id
  })

  await inngest.send({
    name: 'lead.stage_changed',
    data: { orgId: org.id, leadId, stageId: newStageId }
  })

  // ── Travel niche: auto-create a pre-filled sale when the lead is won ───────
  if (stage?.is_won) {
    const { maybeCreateTravelSaleOnWon } = await import('@/actions/travel-sales')
    await maybeCreateTravelSaleOnWon(supabase, org as any, leadId, user.id)
  }

  // ── Meta CAPI: Purchase (won) or NotQualified (lost) ──────────────────────
  if (stage && (stage.is_won || stage.is_lost) && lead) {
    try {
      const { data: orgMeta } = await supabase
        .from('organizations')
        .select('meta_pixel_id, meta_access_token')
        .eq('id', org.id)
        .maybeSingle()

      if (orgMeta?.meta_pixel_id && orgMeta?.meta_access_token) {
        const { sendCapiEvent } = await import('@/lib/meta/capi')
        await sendCapiEvent({
          pixelId:     orgMeta.meta_pixel_id,
          accessToken: orgMeta.meta_access_token,
          eventName:   stage.is_won ? 'Purchase' : 'NotQualified',
          eventId:     `${leadId}-${stage.is_won ? 'won' : 'lost'}`,
          email:       lead.email,
          phone:       lead.phone,
          firstName:   lead.name,
          // Purchase value in BRL
          ...(stage.is_won && lead.value_cents
            ? { currency: 'BRL', value: lead.value_cents / 100 }
            : {}),
        })
      }
    } catch (capiErr: any) {
      // CAPI failure must never block the stage move
      console.error('[moveLeadToStage] CAPI error:', capiErr?.message)
    }
  }

  revalidatePath(`/app/${orgSlug}/pipeline`)
  return { ok: true }
}

export async function getLead(orgSlug: string, leadId: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data: lead } = await supabase.from('leads').select('*, pipeline_stages(name)').eq('id', leadId).eq('organization_id', org.id).maybeSingle()
  const { data: activities } = await supabase.from('lead_activities').select('*').eq('lead_id', leadId).order('created_at', { ascending: false })
  const { data: automation_runs } = await supabase.from('automation_runs').select('*, automations(name)').eq('lead_id', leadId).order('started_at', { ascending: false })

  return { lead, activities, automation_runs }
}

/**
 * Update a lead's value_cents — called inline from the Kanban card.
 */
export async function updateLeadValue(orgSlug: string, leadId: string, valueCents: number) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { error } = await supabase
    .from('leads')
    .update({ value_cents: valueCents || null })
    .eq('id', leadId)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/pipeline`)
  return { ok: true as const }
}

/**
 * Run AI qualification directly for a single lead.
 * Executes synchronously (no Inngest required) so the button always works —
 * both in local dev and production. The Inngest trigger on form.submitted still
 * fires in the background for automatic qualification.
 */
export async function requestLeadQualification(orgSlug: string, leadId: string) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)

  const { runLeadQualification } = await import('@/lib/ai/run-qualification')
  const result = await runLeadQualification(leadId, org.id, null)

  if (result.ok) {
    revalidatePath(`/app/${orgSlug}/leads/${leadId}`)
  }

  return result
}

/**
 * Bulk update — used by selection actions on the leads list (move stage,
 * add tag, assign user). Always scoped to the caller's org via the explicit
 * `.eq('organization_id', org.id)` so RLS + app filter is double-defense.
 */
export async function bulkUpdateLeads(
  orgSlug: string,
  leadIds: string[],
  updates: { stage_id?: string; addTag?: string; assigned_to?: string },
) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  if (!leadIds.length) return { ok: true as const, count: 0 }

  // Stage move + assign go through a single update; tag adds need to merge
  // with existing tags so we have to read first.
  const directPatch: any = {}
  if (updates.stage_id) directPatch.stage_id = updates.stage_id
  if (updates.assigned_to) directPatch.assigned_to = updates.assigned_to

  if (Object.keys(directPatch).length > 0) {
    directPatch.updated_at = new Date().toISOString()
    const { error } = await supabase
      .from('leads')
      .update(directPatch)
      .in('id', leadIds)
      .eq('organization_id', org.id)
    if (error) return { ok: false as const, error: error.message }
  }

  if (updates.addTag) {
    const tag = updates.addTag.trim()
    if (tag) {
      const { data: rows } = await supabase
        .from('leads')
        .select('id, tags')
        .in('id', leadIds)
        .eq('organization_id', org.id)
      for (const r of rows || []) {
        const next = Array.from(new Set([...(r.tags || []), tag]))
        await supabase.from('leads').update({ tags: next }).eq('id', r.id).eq('organization_id', org.id)
      }
      // Fan out tag-added events for automations.
      for (const id of leadIds) {
        await inngest.send({ name: 'lead.tag_added', data: { orgId: org.id, leadId: id, tag } })
      }
    }
  }

  // Single audit row per bulk action keeps lead_activities lean.
  await supabase.from('lead_activities').insert(
    leadIds.map(leadId => ({
      lead_id: leadId,
      organization_id: org.id,
      type: 'bulk_updated',
      payload: updates,
      created_by: user.id,
    })),
  )

  revalidatePath(`/app/${orgSlug}/leads`)
  return { ok: true as const, count: leadIds.length }
}

export async function bulkDeleteLeads(orgSlug: string, leadIds: string[]) {
  if (isImpersonating()) {
    return { ok: false as const, error: 'Ações destrutivas não são permitidas em modo de impersonação.' }
  }
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  if (!leadIds.length) return { ok: true as const, count: 0 }

  const { error } = await supabase
    .from('leads')
    .delete()
    .in('id', leadIds)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/leads`)
  return { ok: true as const, count: leadIds.length }
}

/**
 * Looks up an existing lead by email or phone within the org. Used by the
 * "novo lead" dialog to warn about duplicates before creating.
 */
export async function findDuplicateLead(
  orgSlug: string,
  payload: { email?: string; phone?: string },
) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const email = (payload.email || '').trim().toLowerCase()
  const phone = (payload.phone || '').replace(/\D/g, '')

  if (!email && !phone) return { match: null }

  const filters: string[] = []
  if (email) filters.push(`email.eq.${email}`)
  if (phone) filters.push(`phone.eq.${phone}`)

  const { data } = await supabase
    .from('leads')
    .select('id, name, email, phone')
    .eq('organization_id', org.id)
    .or(filters.join(','))
    .limit(1)
    .maybeSingle()

  return { match: data || null }
}

// On-demand search used by the Combobox in TaskCard so we don't have to ship
// every lead to the client. Returns a small page; ilike matches name, email,
// or phone. Empty query returns the most recent leads as a default list.
export async function searchLeads(orgSlug: string, query: string, limit = 20) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const q = (query || '').trim()
  let builder = supabase
    .from('leads')
    .select('id, name, email, phone')
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (q) {
    // escape % and _ so user input can't broaden the match unexpectedly
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
