'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization, isImpersonating } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'

export type BudgetDocumentRow = {
  id: string
  organization_id: string
  contato_id: string | null
  client_name: string | null
  destination: string | null
  hotel_name: string | null
  start_date: string | null
  end_date: string | null
  pax_adults: number | null
  pax_children: number | null
  included: string[]
  not_included: string[]
  payment_conditions: { label: string; value: string }[]
  total_cents: number
  price_per_person_cents: number | null
  validity_days: number
  operadora: string | null
  observacoes: string | null
  origem_arquivo: { path: string; name: string; mime_type: string } | null
  extracted_data: Record<string, any> | null
  status: 'draft' | 'sent'
  created_by: string | null
  created_at: string
  updated_at: string
}

const WRITABLE = [
  'contato_id', 'client_name', 'destination', 'hotel_name', 'start_date', 'end_date',
  'pax_adults', 'pax_children', 'included', 'not_included', 'payment_conditions',
  'total_cents', 'price_per_person_cents', 'validity_days', 'operadora', 'observacoes', 'status',
] as const

function pick(input: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {}
  for (const k of WRITABLE) if (k in input) out[k] = input[k]
  for (const k of ['start_date', 'end_date', 'contato_id'] as const) {
    if (k in out && !out[k]) out[k] = null
  }
  for (const k of ['total_cents', 'price_per_person_cents', 'validity_days', 'pax_adults', 'pax_children'] as const) {
    if (k in out && out[k] != null && out[k] !== '') {
      const n = Number(out[k])
      out[k] = Number.isFinite(n) ? Math.round(n) : null
    } else if (k in out) {
      out[k] = null
    }
  }
  return out
}

export async function listBudgetDocuments(orgSlug: string): Promise<BudgetDocumentRow[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('budget_documents')
    .select('*')
    .eq('organization_id', org.id)
    .order('updated_at', { ascending: false })
    .limit(500)
  return (data as BudgetDocumentRow[]) ?? []
}

export async function getBudgetDocument(orgSlug: string, id: string): Promise<BudgetDocumentRow | null> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('budget_documents')
    .select('*')
    .eq('organization_id', org.id)
    .eq('id', id)
    .maybeSingle()
  return (data as BudgetDocumentRow) ?? null
}

const ATTACHMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif']
const ATTACHMENT_MAX_BYTES = 15 * 1024 * 1024

/**
 * Cria um orçamento a partir dos campos já mapeados da extração por IA
 * (feita no client via DocumentExtractDialog) + o arquivo original enviado
 * na mesma etapa, pra guardar como referência.
 */
export async function createBudgetDocument(orgSlug: string, formData: FormData) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'sales')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  let fields: Record<string, any> = {}
  try {
    fields = JSON.parse(String(formData.get('fields') || '{}'))
  } catch {
    return { ok: false as const, error: 'Dados inválidos.' }
  }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('budget_documents')
    .insert({
      organization_id: org.id,
      created_by: user.id,
      extracted_data: fields.extracted_data ?? null,
      ...pick(fields),
    })
    .select()
    .single()

  if (error || !data) return { ok: false as const, error: error?.message || 'Erro ao criar orçamento' }
  const created = data as BudgetDocumentRow

  const file = formData.get('file') as File | null
  if (file && file.size > 0) {
    if (!ATTACHMENT_TYPES.includes(file.type)) {
      return { ok: true as const, data: created, attachmentError: 'Formato de arquivo não suportado para anexo.' }
    }
    if (file.size > ATTACHMENT_MAX_BYTES) {
      return { ok: true as const, data: created, attachmentError: 'Arquivo original muito grande para anexar (limite 15 MB).' }
    }

    const extMap: Record<string, string> = {
      'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
    }
    const ext = extMap[file.type] ?? 'bin'
    const path = `${org.id}/${created.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const name = (file.name || `orcamento.${ext}`).replace(/[\r\n"]/g, '').slice(0, 120)

    const bytes = await file.arrayBuffer()
    const { error: uploadError } = await supabase.storage
      .from('budget-documents')
      .upload(path, bytes, { contentType: file.type, upsert: false })

    if (!uploadError) {
      await supabase
        .from('budget_documents')
        .update({ origem_arquivo: { path, name, mime_type: file.type } })
        .eq('id', created.id)
        .eq('organization_id', org.id)
      created.origem_arquivo = { path, name, mime_type: file.type }
    }
  }

  revalidatePath(`/app/${orgSlug}/cotacoes`)
  return { ok: true as const, data: created }
}

export async function updateBudgetDocument(orgSlug: string, id: string, input: Record<string, any>) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'sales')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('budget_documents')
    .update(pick(input))
    .eq('id', id)
    .eq('organization_id', org.id)
    .select()
    .single()

  if (error || !data) return { ok: false as const, error: error?.message || 'Erro ao salvar orçamento' }
  revalidatePath(`/app/${orgSlug}/cotacoes`)
  return { ok: true as const, data: data as BudgetDocumentRow }
}

export async function deleteBudgetDocument(orgSlug: string, id: string) {
  if (isImpersonating()) {
    return { ok: false as const, error: 'Ações destrutivas não são permitidas em modo de impersonação.' }
  }
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'sales')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  const { data: doc } = await supabase
    .from('budget_documents')
    .select('origem_arquivo')
    .eq('id', id)
    .eq('organization_id', org.id)
    .maybeSingle()

  const { error } = await supabase
    .from('budget_documents')
    .delete()
    .eq('id', id)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message || 'Erro ao excluir orçamento' }

  const origem = (doc as any)?.origem_arquivo
  if (origem?.path) await supabase.storage.from('budget-documents').remove([origem.path])

  revalidatePath(`/app/${orgSlug}/cotacoes`)
  return { ok: true as const }
}

export async function getBudgetDocumentSourceUrl(orgSlug: string, id: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data: doc } = await supabase
    .from('budget_documents')
    .select('origem_arquivo')
    .eq('id', id)
    .eq('organization_id', org.id)
    .maybeSingle()

  const path = (doc as any)?.origem_arquivo?.path
  if (!path) return { ok: false as const, error: 'Nenhum arquivo original anexado.' }

  const { data: signed, error } = await supabase.storage
    .from('budget-documents')
    .createSignedUrl(path, 60 * 5)

  if (error || !signed?.signedUrl) return { ok: false as const, error: error?.message || 'Não foi possível assinar URL' }
  return { ok: true as const, url: signed.signedUrl }
}
