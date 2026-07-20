'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization, isImpersonating } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'

export type DocumentTemplateRow = {
  id: string
  organization_id: string
  name: string
  category: string | null
  body_html: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export async function listDocumentTemplates(orgSlug: string): Promise<DocumentTemplateRow[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('document_templates')
    .select('*')
    .eq('organization_id', org.id)
    .order('name', { ascending: true })
  return (data as DocumentTemplateRow[]) ?? []
}

export async function getDocumentTemplate(orgSlug: string, id: string): Promise<DocumentTemplateRow | null> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('document_templates')
    .select('*')
    .eq('organization_id', org.id)
    .eq('id', id)
    .maybeSingle()
  return (data as DocumentTemplateRow) ?? null
}

export async function createDocumentTemplate(orgSlug: string, name: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'sales')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  if (!name?.trim()) return { ok: false as const, error: 'Informe um nome pro modelo.' }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('document_templates')
    .insert({
      organization_id: org.id,
      created_by: user.id,
      name: name.trim(),
      body_html: '<p>Escreva o modelo do documento aqui. Use {{nome_do_campo}} para marcar um campo a ser preenchido na hora de gerar.</p>',
    })
    .select()
    .single()

  if (error || !data) return { ok: false as const, error: error?.message || 'Erro ao criar modelo' }
  revalidatePath(`/app/${orgSlug}/documentos`)
  return { ok: true as const, data: data as DocumentTemplateRow }
}

export async function updateDocumentTemplate(orgSlug: string, id: string, input: { name?: string; category?: string | null; body_html?: string }) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'sales')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const patch: Record<string, any> = {}
  if ('name' in input) patch.name = input.name
  if ('category' in input) patch.category = input.category || null
  if ('body_html' in input) patch.body_html = input.body_html

  const supabase = createClient()
  const { data, error } = await supabase
    .from('document_templates')
    .update(patch)
    .eq('id', id)
    .eq('organization_id', org.id)
    .select()
    .single()

  if (error || !data) return { ok: false as const, error: error?.message || 'Erro ao salvar modelo' }
  revalidatePath(`/app/${orgSlug}/documentos`)
  return { ok: true as const, data: data as DocumentTemplateRow }
}

export async function deleteDocumentTemplate(orgSlug: string, id: string) {
  if (isImpersonating()) {
    return { ok: false as const, error: 'Ações destrutivas não são permitidas em modo de impersonação.' }
  }
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'sales')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  const { error } = await supabase
    .from('document_templates')
    .delete()
    .eq('id', id)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message || 'Erro ao excluir modelo' }
  revalidatePath(`/app/${orgSlug}/documentos`)
  return { ok: true as const }
}
