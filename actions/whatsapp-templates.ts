'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// ── Types ─────────────────────────────────────────────────────────────────────

export type WaTemplate = {
  id: string
  organization_id: string
  name: string
  display_name: string
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION'
  language: string
  header_type: 'none' | 'text' | 'image' | 'video' | 'document'
  header_text: string | null
  header_media_url: string | null
  body_text: string
  variable_names: string[] | null
  footer_text: string | null
  status: 'local' | 'pending' | 'approved' | 'rejected'
  created_at: string
}

export type WaTemplatePayload = Omit<WaTemplate, 'id' | 'organization_id' | 'created_at'>

// ── Helper ────────────────────────────────────────────────────────────────────

async function getOrgId(orgSlug: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('organizations').select('id').eq('slug', orgSlug).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Organização não encontrada')
  return data.id
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function getWaTemplates(orgSlug: string): Promise<WaTemplate[]> {
  const supabase = createClient()
  const orgId = await getOrgId(orgSlug)
  const { data, error } = await supabase
    .from('whatsapp_templates')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as WaTemplate[]
}

export async function createWaTemplate(orgSlug: string, payload: WaTemplatePayload) {
  const orgId = await getOrgId(orgSlug)
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('whatsapp_templates')
    .insert({ ...payload, organization_id: orgId })
    .select()
    .maybeSingle()
  if (error) throw new Error(error.message)
  revalidatePath(`/app/${orgSlug}/whatsapp-templates`)
  return data as WaTemplate
}

export async function updateWaTemplate(orgSlug: string, id: string, payload: Partial<WaTemplatePayload>) {
  const orgId = await getOrgId(orgSlug)
  const admin = createAdminClient()
  const { error } = await admin
    .from('whatsapp_templates')
    .update(payload)
    .eq('id', id)
    .eq('organization_id', orgId)
  if (error) throw new Error(error.message)
  revalidatePath(`/app/${orgSlug}/whatsapp-templates`)
}

export async function deleteWaTemplate(orgSlug: string, id: string) {
  const orgId = await getOrgId(orgSlug)
  const admin = createAdminClient()
  const { error } = await admin
    .from('whatsapp_templates')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId)
  if (error) throw new Error(error.message)
  revalidatePath(`/app/${orgSlug}/whatsapp-templates`)
}

// ── Media upload ──────────────────────────────────────────────────────────────

export async function uploadWaMedia(orgSlug: string, file: FormData): Promise<string> {
  const orgId = await getOrgId(orgSlug)
  const supabase = createClient()
  const raw = file.get('file') as File
  if (!raw) throw new Error('Nenhum arquivo enviado')

  const ext = raw.name.split('.').pop() ?? 'bin'
  const path = `${orgId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

  const { error } = await supabase.storage.from('whatsapp-assets').upload(path, raw, {
    contentType: raw.type,
    upsert: false,
  })
  if (error) throw new Error(error.message)

  const { data } = supabase.storage.from('whatsapp-assets').getPublicUrl(path)
  return data.publicUrl
}
