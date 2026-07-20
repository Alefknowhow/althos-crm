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

const DEFAULT_CONTRACT_BODY = `<p><strong>Contrato de Prestação de Serviços de Viagem</strong></p>
<p>Pelo presente instrumento, <strong>{{org.nome}}</strong> ({{org.cnpj}}), doravante CONTRATADA, e <strong>{{sale.cliente}}</strong>, doravante CONTRATANTE, celebram o presente contrato de prestação de serviços de intermediação de viagem.</p>
<p><strong>1. Objeto</strong><br/>Pacote com destino a {{sale.destino}}, hospedagem em {{sale.hotel}}, no período de {{sale.data_ida}} a {{sale.data_volta}}, operado por {{sale.operadora}}.</p>
<p><strong>2. Valor e forma de pagamento</strong><br/>Valor total: {{sale.valor_total}}. Forma de pagamento: {{sale.forma_pagamento}}.</p>
<p><strong>3. Política de cancelamento</strong><br/>{{sale.politica_cancelamento}}</p>
<p><strong>4. Informações importantes</strong><br/>{{sale.informacoes_importantes}}</p>
<p><strong>5. Informações de serviço</strong><br/>{{sale.informacoes_servico}}</p>`

/**
 * O "contrato padrão" da agência é só um `document_templates` marcado
 * como tal via `organizations.contract_template_id` — reaproveita 100% o
 * mesmo CRUD/editor de Documentos, só que os merge fields `{{sale.*}}`/
 * `{{org.*}}` são resolvidos automaticamente a partir da venda (não
 * pedidos manualmente como no Gerador de Documentos).
 */
export async function getOrgContractTemplate(orgSlug: string): Promise<DocumentTemplateRow | null> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const contractTemplateId = (org as any).contract_template_id as string | null
  if (!contractTemplateId) return null
  const { data } = await supabase
    .from('document_templates')
    .select('*')
    .eq('organization_id', org.id)
    .eq('id', contractTemplateId)
    .maybeSingle()
  return (data as DocumentTemplateRow) ?? null
}

export async function saveOrgContractTemplate(orgSlug: string, bodyHtml: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'sales')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  const contractTemplateId = (org as any).contract_template_id as string | null

  if (contractTemplateId) {
    const { error } = await supabase
      .from('document_templates')
      .update({ body_html: bodyHtml })
      .eq('id', contractTemplateId)
      .eq('organization_id', org.id)
    if (error) return { ok: false as const, error: error.message || 'Erro ao salvar contrato padrão' }
  } else {
    const { data, error } = await supabase
      .from('document_templates')
      .insert({ organization_id: org.id, created_by: user.id, name: 'Contrato padrão', category: 'contrato', body_html: bodyHtml })
      .select('id')
      .single()
    if (error || !data) return { ok: false as const, error: error?.message || 'Erro ao criar contrato padrão' }

    const { error: orgError } = await supabase
      .from('organizations')
      .update({ contract_template_id: data.id })
      .eq('id', org.id)
    if (orgError) return { ok: false as const, error: orgError.message }
  }

  revalidatePath(`/app/${orgSlug}/reservas/contrato-padrao`)
  return { ok: true as const }
}

export async function getDefaultContractBody(): Promise<string> {
  return DEFAULT_CONTRACT_BODY
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
