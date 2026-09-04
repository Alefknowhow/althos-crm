'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization, isImpersonating } from '@/lib/supabase/types'
import { leadSchema } from '@/lib/validators/lead'
import { revalidatePath } from 'next/cache'
import { canCreateLead } from '@/lib/billing/limits'
import { isAccessBlocked } from '@/lib/billing/plans'
import { checkContatoPermission, FROZEN_ERROR } from './contatos-shared'

/* =========================================================
 *  Lead CRUD (create/update/delete/notes)
 * ========================================================= */

export async function createLead(orgSlug: string, formData: FormData) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkContatoPermission(org.id, user.id)
  if (!perm.allowed) return { ok: false, error: perm.reason }
  if (isAccessBlocked(org as any)) return { ok: false, error: FROZEN_ERROR }

  if (!(await canCreateLead(org.id))) {
    return { ok: false, error: 'Limite de contatos atingido para o seu plano.' }
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
  const source = (formData.get('source') as string) || 'manual'

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

  if (!stage_id) {
    return { ok: false, error: 'Configure um pipeline com pelo menos um estágio antes de criar contatos.' }
  }

  const { data: stageInfo } = await supabase
    .from('pipeline_stages')
    .select('pipeline_id')
    .eq('id', stage_id)
    .maybeSingle()

  const { data: lead, error } = await supabase.from('contatos').insert({
    organization_id: org.id,
    pipeline_id: stageInfo?.pipeline_id,
    stage_id,
    name,
    email: email || null,
    phone: phone || null,
    value_cents,
    tags,
    source,
    assigned_to: user.id
  }).select().single()

  if (error || !lead) {
    return { ok: false, error: error?.message || 'Erro ao criar contato' }
  }

  await supabase.from('negocios').insert({
    organization_id: org.id,
    contato_id: lead.id,
    pipeline_id: stageInfo?.pipeline_id,
    stage_id,
    value_cents,
    status: 'open',
    assigned_to: user.id,
    created_by: user.id,
  })

  await supabase.from('contato_activities').insert({
    contato_id: lead.id,
    organization_id: org.id,
    type: 'manual_created',
    payload: {},
    created_by: user.id
  })

  revalidatePath(`/app/${orgSlug}/contatos`)
  return { ok: true, lead }
}

export async function addLeadNote(orgSlug: string, leadId: string, formData: FormData) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkContatoPermission(org.id, user.id)
  if (!perm.allowed) return { ok: false, error: perm.reason }
  const supabase = createClient()

  const text = formData.get('text') as string
  if (!text || text.trim() === '') return { ok: false, error: 'Nota vazia' }

  const { error } = await supabase.from('contato_activities').insert({
    contato_id: leadId,
    organization_id: org.id,
    type: 'note',
    payload: { text },
    created_by: user.id
  })

  if (error) return { ok: false, error: error.message }

  revalidatePath(`/app/${orgSlug}/contatos/${leadId}`)
  return { ok: true }
}

/** Lista só as anotações (contato_activities type='note') de um lead — usado
 *  pela aba "Anotações" do painel de detalhes (WhatsApp/Instagram). */
export async function listContatoNotes(orgSlug: string, contatoId: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkContatoPermission(org.id, user.id)
  if (!perm.allowed) return []
  const supabase = createClient()
  const { data } = await supabase
    .from('contato_activities')
    .select('id, payload, created_at, created_by')
    .eq('contato_id', contatoId)
    .eq('organization_id', org.id)
    .eq('type', 'note')
    .order('created_at', { ascending: false })
  return data || []
}

import { inngest } from '@/lib/inngest/client'

export async function updateLead(orgSlug: string, leadId: string, formData: FormData) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkContatoPermission(org.id, user.id)
  if (!perm.allowed) return { ok: false, error: perm.reason }
  if (isAccessBlocked(org as any)) return { ok: false, error: FROZEN_ERROR }
  const supabase = createClient()

  const { data: oldLead } = await supabase.from('contatos').select('tags').eq('id', leadId).maybeSingle()

  const updates: any = {}
  const name = formData.get('name') as string
  if (name) updates.name = name
  const email = formData.get('email') as string
  if (email !== null) updates.email = email || null
  const phone = formData.get('phone') as string
  if (phone !== null) updates.phone = phone || null
  const cpf = formData.get('cpf') as string
  if (cpf !== null) updates.cpf = cpf || null
  const date_of_birth = formData.get('date_of_birth') as string
  if (date_of_birth !== null) updates.date_of_birth = date_of_birth || null

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

  const internal_notes = formData.get('internal_notes') as string
  if (internal_notes !== null) updates.internal_notes = internal_notes || null

  const { error } = await supabase.from('contatos').update(updates).eq('id', leadId).eq('organization_id', org.id)

  if (error) return { ok: false, error: error.message }

  for (const tag of newTagsAdded) {
    await inngest.send({
      name: 'lead.tag_added',
      data: { orgId: org.id, leadId, tag }
    })
  }

  revalidatePath(`/app/${orgSlug}/contatos/${leadId}`)
  revalidatePath(`/app/${orgSlug}/contatos`)
  return { ok: true }
}

export async function deleteLead(orgSlug: string, leadId: string) {
  if (isImpersonating()) {
    return { ok: false, error: 'Ações destrutivas não são permitidas em modo de impersonação.' }
  }
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkContatoPermission(org.id, user.id)
  if (!perm.allowed) return { ok: false, error: perm.reason }
  if (isAccessBlocked(org as any)) return { ok: false, error: FROZEN_ERROR }
  const supabase = createClient()

  const { error } = await supabase.from('contatos').delete().eq('id', leadId).eq('organization_id', org.id)
  if (error) return { ok: false, error: error.message }

  revalidatePath(`/app/${orgSlug}/contatos`)
  return { ok: true }
}

