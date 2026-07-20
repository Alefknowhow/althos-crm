'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'

export type AttachmentDocumentType = 'medif' | 'fremec'

/**
 * Modelo em PDF pra download (MEDIF, FREMEC, e futuros) — um por
 * organização por tipo de documento. Esses formulários exigem assinatura
 * física do médico/passageiro, então o sistema nunca os gera; só
 * disponibiliza o modelo em branco enviado pela agência.
 */
export async function getAttachmentTemplateInfo(orgSlug: string, documentType: AttachmentDocumentType): Promise<{ name: string } | null> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('attachment_templates')
    .select('name')
    .eq('organization_id', org.id)
    .eq('document_type', documentType)
    .maybeSingle()
  return data ? { name: data.name } : null
}

export async function getAttachmentTemplateUrl(orgSlug: string, documentType: AttachmentDocumentType) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data: row } = await supabase
    .from('attachment_templates')
    .select('path')
    .eq('organization_id', org.id)
    .eq('document_type', documentType)
    .maybeSingle()
  if (!row?.path) return { ok: false as const, error: 'Nenhum modelo enviado ainda.' }

  const { data: signed, error } = await supabase.storage
    .from('medif-templates')
    .createSignedUrl(row.path, 60 * 5)

  if (error || !signed?.signedUrl) return { ok: false as const, error: error?.message || 'Não foi possível assinar URL' }
  return { ok: true as const, url: signed.signedUrl }
}

export async function uploadAttachmentTemplate(orgSlug: string, documentType: AttachmentDocumentType, formData: FormData) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'sales')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { ok: false as const, error: 'Arquivo vazio' }
  if (file.type !== 'application/pdf') return { ok: false as const, error: 'Envie um arquivo PDF.' }
  if (file.size > 15 * 1024 * 1024) return { ok: false as const, error: 'Arquivo muito grande. O limite é 15 MB.' }

  const supabase = createClient()

  const { data: existing } = await supabase
    .from('attachment_templates')
    .select('path')
    .eq('organization_id', org.id)
    .eq('document_type', documentType)
    .maybeSingle()

  const path = `${org.id}/${Date.now()}-${documentType}-template.pdf`
  const name = (file.name || `${documentType}.pdf`).replace(/[\r\n"]/g, '').slice(0, 120)

  const bytes = await file.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from('medif-templates')
    .upload(path, bytes, { contentType: 'application/pdf', upsert: false })
  if (uploadError) return { ok: false as const, error: uploadError.message }

  const { error: upsertError } = await supabase
    .from('attachment_templates')
    .upsert({ organization_id: org.id, document_type: documentType, path, name }, { onConflict: 'organization_id,document_type' })
  if (upsertError) {
    await supabase.storage.from('medif-templates').remove([path])
    return { ok: false as const, error: upsertError.message }
  }

  if (existing?.path) {
    await supabase.storage.from('medif-templates').remove([existing.path])
  }

  revalidatePath(`/app/${orgSlug}/documentos`)
  return { ok: true as const, name }
}

export async function removeAttachmentTemplate(orgSlug: string, documentType: AttachmentDocumentType) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'sales')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  const { data: existing } = await supabase
    .from('attachment_templates')
    .select('path')
    .eq('organization_id', org.id)
    .eq('document_type', documentType)
    .maybeSingle()

  await supabase
    .from('attachment_templates')
    .delete()
    .eq('organization_id', org.id)
    .eq('document_type', documentType)

  if (existing?.path) {
    await supabase.storage.from('medif-templates').remove([existing.path])
  }

  revalidatePath(`/app/${orgSlug}/documentos`)
  return { ok: true as const }
}
