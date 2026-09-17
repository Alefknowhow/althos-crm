'use server'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Form slugs back the public URL (`/f/{slug}`) and are GLOBALLY unique.
 * The check MUST bypass RLS — otherwise it can't see slugs in other orgs,
 * returns false negatives, and the INSERT trips the unique constraint.
 *
 * We can't use the project's `createAdminClient` here because that wraps
 * `@supabase/ssr`'s createServerClient, which still attaches the logged-in
 * user's auth cookie even when handed the service role key — the cookie
 * wins and RLS is enforced. Use the raw service-role client instead.
 *
 * Extracted out of actions/forms.ts so actions/forms-ai.ts (form generated
 * by conversation) can reuse it without duplicating the RLS workaround.
 */
export async function generateUniqueFormSlug(name: string): Promise<string> {
  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  const baseSlug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
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
