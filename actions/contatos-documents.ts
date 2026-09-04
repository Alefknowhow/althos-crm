'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization, isImpersonating } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'
import { checkContatoPermission } from './contatos-shared'

const ALLOWED_DOC_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'application/pdf',
])
const MAX_DOC_SIZE = 10 * 1024 * 1024
const DOC_KINDS = ['cpf', 'rg_front', 'rg_back', 'cnh', 'passport', 'visa', 'address_proof', 'contract', 'other'] as const

/* =========================================================
 *  Customer documents, signed URLs, and linked travel records
 * ========================================================= */

export async function uploadCustomerDocument(
  orgSlug: string,
  contatoId: string,
  formData: FormData,
) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkContatoPermission(org.id, user.id)
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  const supabase = createClient()

  const file = formData.get('file') as File | null
  const kindRaw = String(formData.get('kind') || 'other')
  const kind = (DOC_KINDS as readonly string[]).includes(kindRaw) ? kindRaw : 'other'

  if (!file || typeof file !== 'object') return { ok: false as const, error: 'Arquivo ausente' }
  if (!ALLOWED_DOC_MIME.has(file.type)) {
    return { ok: false as const, error: `Tipo não permitido: ${file.type}. Use PNG, JPG, WebP ou PDF.` }
  }
  if (file.size > MAX_DOC_SIZE) {
    return { ok: false as const, error: `Arquivo muito grande (>${MAX_DOC_SIZE / 1024 / 1024}MB)` }
  }

  // Verifica se o contato pertence a esta org (RLS também garante no insert).
  const { data: contato } = await supabase
    .from('contatos')
    .select('id')
    .eq('id', contatoId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!contato) return { ok: false as const, error: 'Contato não encontrado' }

  const rawName = file.name || 'documento'
  const dotIdx = rawName.lastIndexOf('.')
  const ext = dotIdx > 0 ? rawName.slice(dotIdx + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : 'bin'
  const base = (dotIdx > 0 ? rawName.slice(0, dotIdx) : rawName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'doc'

  // Layout do path alinhado à policy: `{org_id}/{contato_id}/{filename}`.
  const path = `${org.id}/${contatoId}/${Date.now()}-${kind}-${base}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from('customer-documents')
    .upload(path, arrayBuffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    console.error('uploadCustomerDocument storage error:', uploadError)
    return { ok: false as const, error: uploadError.message }
  }

  const { error: insertError } = await supabase.from('contato_documents').insert({
    contato_id: contatoId,
    organization_id: org.id,
    kind,
    file_path: path,
    file_name: rawName,
    file_size_bytes: file.size,
    mime_type: file.type,
    uploaded_by: user.id,
  })

  if (insertError) {
    await supabase.storage.from('customer-documents').remove([path])
    return { ok: false as const, error: insertError.message }
  }

  revalidatePath(`/app/${orgSlug}/contatos/${contatoId}`)
  return { ok: true as const }
}

export async function deleteCustomerDocument(orgSlug: string, documentId: string) {
  if (isImpersonating()) {
    return { ok: false as const, error: 'Ações destrutivas não são permitidas em modo de impersonação.' }
  }
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkContatoPermission(org.id, user.id)
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  const supabase = createClient()

  const { data: doc } = await supabase
    .from('contato_documents')
    .select('id, file_path')
    .eq('id', documentId)
    .eq('organization_id', org.id)
    .maybeSingle()

  if (!doc) return { ok: false as const, error: 'Documento não encontrado' }

  const { error: dbError } = await supabase
    .from('contato_documents')
    .delete()
    .eq('id', documentId)
    .eq('organization_id', org.id)
  if (dbError) return { ok: false as const, error: dbError.message }

  await supabase.storage.from('customer-documents').remove([doc.file_path])

  revalidatePath(`/app/${orgSlug}/contatos`)
  return { ok: true as const }
}

export async function getDocumentSignedUrl(orgSlug: string, documentId: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkContatoPermission(org.id, user.id)
  if (!perm.allowed) return { ok: false as const, error: perm.reason || 'Sem permissão' }
  const supabase = createClient()

  const { data: doc } = await supabase
    .from('contato_documents')
    .select('file_path')
    .eq('id', documentId)
    .eq('organization_id', org.id)
    .maybeSingle()

  if (!doc) return { ok: false as const, error: 'Documento não encontrado' }

  const { data: signed, error } = await supabase.storage
    .from('customer-documents')
    .createSignedUrl(doc.file_path, 60 * 5) // 5 min

  if (error || !signed?.signedUrl) {
    return { ok: false as const, error: error?.message || 'Não foi possível assinar URL' }
  }
  return { ok: true as const, url: signed.signedUrl }
}

// =====================================================================
// Registros de viagem vinculados a um contato (para os atalhos da lista:
// "Cotações enviadas" e "Reservas"). Carregado sob demanda quando o popup
// é aberto, evitando consultas por linha na listagem.
// =====================================================================

export type ContatoQuoteLink = {
  id: string
  title: string | null
  client_name: string | null
  status: string | null
  total_cents: number | null
  created_at: string | null
  public_token: string | null
}

export type ContatoReservationLink = {
  id: string
  client_name: string | null
  destination: string | null
  status: string | null
  total_cents: number | null
  departure_date: string | null
  created_at: string | null
}

export async function getContatoTravelLinks(orgSlug: string, contatoId: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkContatoPermission(org.id, user.id)
  if (!perm.allowed) return { quotes: [], reservations: [] }
  const supabase = createClient()

  const [{ data: quotes }, { data: reservations }] = await Promise.all([
    supabase
      .from('travel_proposals')
      .select('id, title, client_name, status, total_cents, created_at, public_token')
      .eq('organization_id', org.id)
      .eq('contato_id', contatoId)
      .order('created_at', { ascending: false }),
    supabase
      .from('travel_sales')
      .select('id, client_name, destination, status, total_cents, departure_date, created_at')
      .eq('organization_id', org.id)
      .eq('contato_id', contatoId)
      .order('created_at', { ascending: false }),
  ])

  return {
    quotes: (quotes || []) as ContatoQuoteLink[],
    reservations: (reservations || []) as ContatoReservationLink[],
  }
}
