'use server'

/**
 * Financial entry attachments: upload/delete/signed-URL. Split out of
 * actions/financial.ts.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'
import { uploadFile, deleteObject, getObjectSignedUrl } from '@/actions/storage'
import type { FinancialEntryRow } from './financial-shared'

const ATTACHMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const ATTACHMENT_MAX_BYTES = 15 * 1024 * 1024

export async function uploadFinancialAttachment(orgSlug: string, entryId: string, formData: FormData) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'financial')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { ok: false as const, error: 'Arquivo vazio' }
  if (!ATTACHMENT_TYPES.includes(file.type)) {
    return { ok: false as const, error: 'Formato não suportado. Use PDF, JPG, PNG ou WebP.' }
  }
  if (file.size > ATTACHMENT_MAX_BYTES) {
    return { ok: false as const, error: 'Arquivo muito grande. O limite é 15 MB.' }
  }

  const supabase = createClient()
  const { data: entry } = await supabase
    .from('financial_entries')
    .select('anexos')
    .eq('id', entryId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!entry) return { ok: false as const, error: 'Lançamento não encontrado.' }

  const name = (file.name || 'anexo').replace(/[\r\n"]/g, '').slice(0, 120)
  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')

  const uploaded = await uploadFile(orgSlug, {
    category: 'attachments',
    scopeId: entryId,
    filename: name,
    contentType: file.type,
    base64,
  })
  if (!uploaded.ok) return { ok: false as const, error: uploaded.error }

  const anexos = [...((entry as any).anexos || []), { storage_object_id: uploaded.objectId, name, size_bytes: file.size, mime_type: file.type }]
  const { error: updateError } = await supabase
    .from('financial_entries')
    .update({ anexos })
    .eq('id', entryId)
    .eq('organization_id', org.id)
  if (updateError) {
    await deleteObject(orgSlug, uploaded.objectId)
    return { ok: false as const, error: updateError.message }
  }

  revalidatePath(`/app/${orgSlug}/financeiro`)
  return { ok: true as const, anexos }
}

/** `key` identifica o anexo: `storage_object_id` (R2, novo) ou `path`
 *  (Supabase Storage, legado) — o client trata ambos como um identificador
 *  opaco (ver FinancialEntriesView.tsx), então aqui a gente testa os dois
 *  campos pra achar o item certo, igual ao modelo híbrido dos avatares. */
export async function deleteFinancialAttachment(orgSlug: string, entryId: string, key: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'financial')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  const { data: entry } = await supabase
    .from('financial_entries')
    .select('anexos')
    .eq('id', entryId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!entry) return { ok: false as const, error: 'Lançamento não encontrado.' }

  const current = ((entry as any).anexos || []) as FinancialEntryRow['anexos']
  const target = current.find(a => a.storage_object_id === key || a.path === key)
  if (!target) return { ok: false as const, error: 'Anexo não encontrado.' }

  const anexos = current.filter(a => a !== target)
  const { error } = await supabase
    .from('financial_entries')
    .update({ anexos })
    .eq('id', entryId)
    .eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }

  if (target.storage_object_id) await deleteObject(orgSlug, target.storage_object_id)
  else if (target.path) await supabase.storage.from('financial-attachments').remove([target.path])

  revalidatePath(`/app/${orgSlug}/financeiro`)
  return { ok: true as const, anexos }
}

export async function getFinancialAttachmentUrl(orgSlug: string, entryId: string, key: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'financial')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  const supabase = createClient()

  const { data: entry } = await supabase
    .from('financial_entries')
    .select('anexos')
    .eq('id', entryId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!entry) return { ok: false as const, error: 'Lançamento não encontrado.' }

  const target = ((entry as any).anexos || []).find((a: any) => a.storage_object_id === key || a.path === key)
  if (!target) return { ok: false as const, error: 'Anexo não encontrado.' }

  if (target.storage_object_id) {
    const signed = await getObjectSignedUrl(orgSlug, target.storage_object_id)
    if (!signed.ok) return { ok: false as const, error: signed.error }
    return { ok: true as const, url: signed.url }
  }

  const { data: signed, error } = await supabase.storage
    .from('financial-attachments')
    .createSignedUrl(target.path, 60 * 5)

  if (error || !signed?.signedUrl) return { ok: false as const, error: error?.message || 'Não foi possível assinar URL' }
  return { ok: true as const, url: signed.signedUrl }
}
