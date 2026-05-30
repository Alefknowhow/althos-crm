'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions'
import { revalidatePath } from 'next/cache'

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

/**
 * Form slugs back the public URL (`/f/{slug}`) and are GLOBALLY unique.
 * The check MUST bypass RLS \u2014 otherwise it can't see slugs in other orgs,
 * returns false negatives, and the INSERT trips the unique constraint.
 *
 * We can't use the project's `createAdminClient` here because that wraps
 * `@supabase/ssr`'s createServerClient, which still attaches the logged-in
 * user's auth cookie even when handed the service role key \u2014 the cookie
 * wins and RLS is enforced. Use the raw service-role client instead.
 */
async function generateUniqueSlug(name: string): Promise<string> {
  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  const baseSlug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'form'
  let slug = baseSlug
  let count = 1
  while (count < 1000) {
    const { data } = await admin.from('forms').select('id').eq('slug', slug).maybeSingle()
    if (!data) break
    slug = `${baseSlug}-${count}`
    count++
  }
  return slug
}

export async function createForm(orgSlug: string, name: string) {
  const user = await requireAuth()
  const org  = await getCurrentOrganization(orgSlug)

  const perm = await checkMemberPermission(org.id, user.id, 'forms')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()

  const slug = await generateUniqueSlug(name)

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
