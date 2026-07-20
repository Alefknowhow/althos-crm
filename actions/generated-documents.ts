'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization, isImpersonating } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { renderTemplate } from '@/lib/inngest/functions'
import { revalidatePath } from 'next/cache'

export type GeneratedDocumentRow = {
  id: string
  organization_id: string
  template_id: string | null
  title: string
  body_html: string
  field_values: Record<string, string>
  created_by: string | null
  created_at: string
}

export async function listGeneratedDocuments(orgSlug: string): Promise<GeneratedDocumentRow[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('generated_documents')
    .select('*')
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })
    .limit(500)
  return (data as GeneratedDocumentRow[]) ?? []
}

export async function getGeneratedDocument(orgSlug: string, id: string): Promise<GeneratedDocumentRow | null> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('generated_documents')
    .select('*')
    .eq('organization_id', org.id)
    .eq('id', id)
    .maybeSingle()
  return (data as GeneratedDocumentRow) ?? null
}

/**
 * Gera um documento a partir de um modelo, resolvendo `{{chave}}` com os
 * valores digitados manualmente (sem puxar nada do contato). O resultado é
 * um snapshot — se o modelo mudar depois, o documento já gerado não muda.
 */
export async function generateDocument(
  orgSlug: string,
  input: { templateId: string; title: string; fieldValues: Record<string, string> },
) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'sales')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  if (!input.title?.trim()) return { ok: false as const, error: 'Informe um título pro documento.' }

  const supabase = createClient()
  const { data: template } = await supabase
    .from('document_templates')
    .select('body_html')
    .eq('id', input.templateId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!template) return { ok: false as const, error: 'Modelo não encontrado.' }

  const resolvedHtml = renderTemplate(template.body_html, input.fieldValues)

  const { data, error } = await supabase
    .from('generated_documents')
    .insert({
      organization_id: org.id,
      created_by: user.id,
      template_id: input.templateId,
      title: input.title.trim(),
      body_html: resolvedHtml,
      field_values: input.fieldValues,
    })
    .select()
    .single()

  if (error || !data) return { ok: false as const, error: error?.message || 'Erro ao gerar documento' }
  revalidatePath(`/app/${orgSlug}/documentos`)
  return { ok: true as const, data: data as GeneratedDocumentRow }
}

export async function deleteGeneratedDocument(orgSlug: string, id: string) {
  if (isImpersonating()) {
    return { ok: false as const, error: 'Ações destrutivas não são permitidas em modo de impersonação.' }
  }
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'sales')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  const { error } = await supabase
    .from('generated_documents')
    .delete()
    .eq('id', id)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message || 'Erro ao excluir documento' }
  revalidatePath(`/app/${orgSlug}/documentos`)
  return { ok: true as const }
}
