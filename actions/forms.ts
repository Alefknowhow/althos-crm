'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'
import { generateUniqueFormSlug } from './forms-slug'

// Used by the automations editor to populate the "form.submitted" trigger
// dropdown. Returns the minimal {id, name} shape.
export async function getForms(orgSlug: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('forms')
    .select('id, name')
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })
  return data || []
}

export async function createForm(orgSlug: string, name: string) {
  const user = await requireAuth()
  const org  = await getCurrentOrganization(orgSlug)

  const perm = await checkMemberPermission(org.id, user.id, 'forms')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()

  const slug = await generateUniqueFormSlug(name)

  const initialSchema = {
    fields: [
      { id: 'field_name', type: 'short_text', label: 'Nome', required: true },
      { id: 'field_email', type: 'email', label: 'E-mail', required: true }
    ],
    submitButtonText: 'Enviar',
    thankYouMessage: 'Obrigado! Recebemos suas informações.'
  }

  const { data: pipeline } = await supabase
    .from('pipelines').select('id')
    .eq('organization_id', org.id).eq('is_default', true)
    .maybeSingle()

  let stageId: string | null = null
  if (pipeline) {
    const { data: stage } = await supabase
      .from('pipeline_stages').select('id')
      .eq('pipeline_id', pipeline.id)
      .order('position').limit(1).maybeSingle()
    if (stage) stageId = stage.id
  }

  const { data: form, error } = await supabase.from('forms').insert({
    organization_id: org.id,
    name,
    slug,
    schema: initialSchema,
    pipeline_id: pipeline?.id ?? null,
    stage_id: stageId,
    is_active: true
  }).select().single()

  if (error) {
    console.error('createForm error:', error)
    return { ok: false, error: error.message || 'Erro ao criar formulário' }
  }
  revalidatePath(`/app/${orgSlug}/forms`)
  return { ok: true, form }
}

export async function updateForm(orgSlug: string, formId: string, updates: any) {
  const user = await requireAuth()
  const org  = await getCurrentOrganization(orgSlug)

  const perm = await checkMemberPermission(org.id, user.id, 'forms')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()

  const { error } = await supabase.from('forms').update(updates).eq('id', formId).eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/forms`)
  revalidatePath(`/app/${orgSlug}/forms/${formId}/edit`)
  return { ok: true as const }
}

export async function deleteForm(orgSlug: string, formId: string) {
  const user = await requireAuth()
  const org  = await getCurrentOrganization(orgSlug)

  const perm = await checkMemberPermission(org.id, user.id, 'forms')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()

  const { error } = await supabase.from('forms').delete().eq('id', formId).eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/forms`)
  return { ok: true as const }
}

export async function toggleFormActive(orgSlug: string, formId: string, isActive: boolean) {
  return await updateForm(orgSlug, formId, { is_active: isActive })
}

/** Duplica um formulário (schema, pipeline/estágio de destino) como
 *  rascunho pausado — mesmo padrão de "Duplicar" já usado em Automações. */
export async function duplicateForm(orgSlug: string, formId: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)

  const perm = await checkMemberPermission(org.id, user.id, 'forms')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  const { data: original } = await supabase
    .from('forms')
    .select('name, schema, pipeline_id, stage_id')
    .eq('id', formId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!original) return { ok: false as const, error: 'Formulário não encontrado' }

  const name = `${original.name} (cópia)`
  const slug = await generateUniqueFormSlug(name)

  const { data: form, error } = await supabase.from('forms').insert({
    organization_id: org.id,
    name,
    slug,
    schema: original.schema,
    pipeline_id: original.pipeline_id,
    stage_id: original.stage_id,
    is_active: false,
  }).select().single()

  if (error) return { ok: false as const, error: error.message || 'Erro ao duplicar formulário' }
  revalidatePath(`/app/${orgSlug}/forms`)
  return { ok: true as const, form }
}
