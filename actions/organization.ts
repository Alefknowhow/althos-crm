'use server'

import { createClient } from '@/lib/supabase/server'
import { slugify } from '@/lib/utils/slugify'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { traduzirErro } from '@/lib/utils/error-translator'
import { revalidatePath } from 'next/cache'
import { DEFAULT_QUALIFIER_PROMPT } from '@/lib/ai/qualifier-prompt'




export async function generateUniqueSlug(name: string) {
  const baseSlug = slugify(name)
  const supabase = createClient()
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
  await requireAuth()
  const name = formData.get('name') as string

  if (!name || name.length < 2) {
    return { ok: false, error: 'Nome da organização inválido' }
  }

  const slug = await generateUniqueSlug(name)
  const supabase = createClient()

  const { data, error } = await supabase
    .rpc('create_organization_for_user', {
      org_name: name,
      org_slug: slug
    })
    .single()

  if (error) {
    return { ok: false, error: traduzirErro(error) }
  }

  return { ok: true, data, redirectTo: `/app/${slug}/pipeline` }
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
