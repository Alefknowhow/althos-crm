'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { createMetaTemplate, getMetaTemplateStatus } from '@/lib/whatsapp/templates-api'
import { uploadFile, getObjectSignedUrl } from '@/actions/storage'
import { resolveSystemSignedUrl } from '@/lib/storage/system'

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
  header_storage_object_id: string | null
  body_text: string
  variable_names: string[] | null
  footer_text: string | null
  status: 'local' | 'pending' | 'approved' | 'rejected'
  meta_template_id: string | null
  rejected_reason: string | null
  created_at: string
}

export type WaTemplatePayload = Omit<WaTemplate, 'id' | 'organization_id' | 'created_at' | 'meta_template_id' | 'rejected_reason'>

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

/** Sobe a amostra de mídia do cabeçalho do template pro R2. Retorna uma
 *  URL (só pra prévia imediata no formulário) e o objectId (referência
 *  estável — o que de fato é persistido em header_storage_object_id;
 *  ver migration 0160 sobre por que nunca guardamos a URL assinada em
 *  si além dessa prévia pontual). */
export async function uploadWaMedia(orgSlug: string, file: FormData): Promise<{ url: string; objectId: string }> {
  const raw = file.get('file') as File
  if (!raw) throw new Error('Nenhum arquivo enviado')

  const base64 = Buffer.from(await raw.arrayBuffer()).toString('base64')
  const uploaded = await uploadFile(orgSlug, {
    category: 'whatsapp',
    filename: raw.name,
    contentType: raw.type,
    base64,
  })
  if (!uploaded.ok) throw new Error(uploaded.error)
  const signed = await getObjectSignedUrl(orgSlug, uploaded.objectId)
  if (!signed.ok) throw new Error(signed.error)

  return { url: signed.url, objectId: uploaded.objectId }
}

// ── Envio/consulta de aprovação direto na Meta ──────────────────────────────

async function getOrgWhatsappCreds(orgSlug: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('organizations')
    .select('id, whatsapp_waba_id, whatsapp_access_token')
    .eq('slug', orgSlug)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Organização não encontrada')
  if (!data.whatsapp_waba_id || !data.whatsapp_access_token) {
    throw new Error('Conecte o WhatsApp em Configurações antes de enviar templates para aprovação.')
  }
  return { orgId: data.id as string, wabaId: data.whatsapp_waba_id as string, accessToken: data.whatsapp_access_token as string }
}

export async function submitWaTemplateToMeta(orgSlug: string, id: string): Promise<WaTemplate> {
  const { orgId, wabaId, accessToken } = await getOrgWhatsappCreds(orgSlug)
  const admin = createAdminClient()

  const { data: template, error: fetchError } = await admin
    .from('whatsapp_templates')
    .select('*')
    .eq('id', id)
    .eq('organization_id', orgId)
    .maybeSingle()
  if (fetchError) throw new Error(fetchError.message)
  if (!template) throw new Error('Template não encontrado')

  // Resolve uma signed URL fresca a partir da referência estável — nunca
  // usa uma URL antiga guardada em algum lugar (ver migration 0160).
  // Template sem header_storage_object_id (upload antigo, legado) cai no
  // header_media_url de sempre.
  const headerMediaUrl = template.header_storage_object_id
    ? await resolveSystemSignedUrl(template.header_storage_object_id)
    : template.header_media_url

  const meta = await createMetaTemplate(wabaId, accessToken, {
    name: template.name,
    category: template.category,
    language: template.language,
    headerType: template.header_type,
    headerText: template.header_text,
    headerMediaUrl,
    bodyText: template.body_text,
    footerText: template.footer_text,
  })

  const { data: updated, error } = await admin
    .from('whatsapp_templates')
    .update({
      status: (meta.status || 'PENDING').toLowerCase(),
      meta_template_id: meta.id,
      rejected_reason: null,
    })
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) throw new Error(error.message)

  revalidatePath(`/app/${orgSlug}/whatsapp-templates`)
  return updated as WaTemplate
}

export async function refreshWaTemplateStatus(orgSlug: string, id: string): Promise<WaTemplate> {
  const { orgId, wabaId, accessToken } = await getOrgWhatsappCreds(orgSlug)
  const admin = createAdminClient()

  const { data: template, error: fetchError } = await admin
    .from('whatsapp_templates')
    .select('*')
    .eq('id', id)
    .eq('organization_id', orgId)
    .maybeSingle()
  if (fetchError) throw new Error(fetchError.message)
  if (!template) throw new Error('Template não encontrado')
  if (!template.meta_template_id) throw new Error('Este template ainda não foi enviado para aprovação.')

  const meta = await getMetaTemplateStatus(wabaId, accessToken, template.meta_template_id)

  const { data: updated, error } = await admin
    .from('whatsapp_templates')
    .update({
      status: (meta.status || template.status).toLowerCase(),
      rejected_reason: meta.rejected_reason || null,
    })
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) throw new Error(error.message)

  revalidatePath(`/app/${orgSlug}/whatsapp-templates`)
  return updated as WaTemplate
}
