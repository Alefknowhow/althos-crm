'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization, isImpersonating } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { slugify } from '@/lib/utils/slugify'
import { revalidatePath } from 'next/cache'

const BUCKET = 'org-documents'
const MAX_SIZE = 15 * 1024 * 1024

export type OrgDocument = {
  id: string
  label: string
  file_name: string
  file_size_bytes: number | null
  created_at: string
}

export async function listOrgDocuments(orgSlug: string): Promise<OrgDocument[]> {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'documentos')
  if (!perm.allowed) return []
  const supabase = createClient()
  const { data } = await supabase
    .from('org_documents')
    .select('id, label, file_name, file_size_bytes, created_at')
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })
  return (data as OrgDocument[]) ?? []
}

export async function uploadOrgDocument(orgSlug: string, formData: FormData) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'documentos')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  const supabase = createClient()

  const file = formData.get('file') as File | null
  const label = String(formData.get('label') || '').trim()

  if (!label) return { ok: false as const, error: 'Informe um rótulo para o documento.' }
  if (!file || typeof file !== 'object') return { ok: false as const, error: 'Arquivo ausente.' }
  if (file.type !== 'application/pdf') return { ok: false as const, error: 'Apenas arquivos PDF são aceitos.' }
  if (file.size > MAX_SIZE) return { ok: false as const, error: `Arquivo muito grande (>${MAX_SIZE / 1024 / 1024}MB).` }

  const slug = slugify(label).slice(0, 60) || 'documento'
  const path = `${org.id}/${Date.now()}-${slug}.pdf`

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: 'application/pdf',
    upsert: false,
  })
  if (uploadError) return { ok: false as const, error: uploadError.message }

  const { error: insertError } = await supabase.from('org_documents').insert({
    organization_id: org.id,
    label,
    file_path: path,
    file_name: file.name || `${label}.pdf`,
    file_size_bytes: file.size,
    mime_type: file.type,
    uploaded_by: user.id,
  })
  if (insertError) {
    await supabase.storage.from(BUCKET).remove([path])
    return { ok: false as const, error: insertError.message }
  }

  revalidatePath(`/app/${orgSlug}/documentos`)
  return { ok: true as const }
}

export async function deleteOrgDocument(orgSlug: string, documentId: string) {
  if (isImpersonating()) {
    return { ok: false as const, error: 'Ações destrutivas não são permitidas em modo de impersonação.' }
  }
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'documentos')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  const supabase = createClient()

  const { data: doc } = await supabase
    .from('org_documents')
    .select('id, file_path')
    .eq('id', documentId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!doc) return { ok: false as const, error: 'Documento não encontrado.' }

  const { error: dbError } = await supabase
    .from('org_documents')
    .delete()
    .eq('id', documentId)
    .eq('organization_id', org.id)
  if (dbError) return { ok: false as const, error: dbError.message }

  await supabase.storage.from(BUCKET).remove([doc.file_path])

  revalidatePath(`/app/${orgSlug}/documentos`)
  return { ok: true as const }
}

export async function getOrgDocumentSignedUrl(orgSlug: string, documentId: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'documentos')
  if (!perm.allowed) return { ok: false as const, error: perm.reason || 'Sem permissão' }
  const supabase = createClient()

  const { data: doc } = await supabase
    .from('org_documents')
    .select('file_path')
    .eq('id', documentId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!doc) return { ok: false as const, error: 'Documento não encontrado.' }

  const { data: signed, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(doc.file_path, 60 * 5)
  if (error || !signed?.signedUrl) return { ok: false as const, error: error?.message || 'Não foi possível gerar o link.' }
  return { ok: true as const, url: signed.signedUrl }
}
