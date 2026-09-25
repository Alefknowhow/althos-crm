'use server'

/**
 * Módulo global de Contratos (issue #16) — fonte única de verdade, sem
 * acoplamento a nenhuma vertical. Relacionamento polimórfico via
 * related_entity_type/related_entity_id (sem FK de banco — validado aqui).
 *
 * Escopo desta leva: contratos criados a partir de agora pelo módulo global.
 * NÃO migra/toca `sale_contracts` (Reservas) nem `plan_contracts` (Tráfego)
 * — esses continuam funcionando exatamente como hoje, webhook incluso.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'

export type RelatedEntityType = 'reserva' | 'venda' | 'oportunidade' | 'cliente' | 'projeto'

async function requireContractsAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'contracts')
  return { user, org, perm }
}

async function logEvent(supabase: ReturnType<typeof createClient>, orgId: string, contractId: string, type: string, payload: Record<string, any> = {}) {
  await supabase.from('contract_events').insert({ organization_id: orgId, contract_id: contractId, type, payload })
}

export async function listContracts(orgSlug: string, filters: { status?: string; search?: string } = {}) {
  const { org, perm } = await requireContractsAccess(orgSlug)
  if (!perm.allowed) return []
  const supabase = createClient()

  let query = supabase
    .from('contracts')
    .select('id, title, status, related_entity_type, related_entity_id, value_cents, created_at, updated_at, sent_at, signed_at, contract_signers(id, name, status)')
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.search) query = query.ilike('title', `%${filters.search}%`)

  const { data } = await query.limit(200)
  return data || []
}

export async function getContract(orgSlug: string, id: string) {
  const { org, perm } = await requireContractsAccess(orgSlug)
  if (!perm.allowed) return null
  const supabase = createClient()

  const { data: contract } = await supabase
    .from('contracts')
    .select('*, contract_signers(*)')
    .eq('id', id)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!contract) return null

  const { data: events } = await supabase
    .from('contract_events')
    .select('*')
    .eq('contract_id', id)
    .order('created_at', { ascending: false })

  return { ...contract, events: events || [] }
}

export async function createContract(orgSlug: string, input: {
  title: string
  relatedEntityType?: RelatedEntityType | null
  relatedEntityId?: string | null
  templateId?: string | null
  fieldValues?: Record<string, any>
  valueCents?: number | null
}) {
  const { user, org, perm } = await requireContractsAccess(orgSlug)
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  if (!input.title?.trim()) return { ok: false as const, error: 'Informe um título para o contrato.' }
  const supabase = createClient()

  let bodyHtml: string | null = null
  if (input.templateId) {
    const { data: template } = await supabase
      .from('document_templates')
      .select('body_html')
      .eq('id', input.templateId)
      .eq('organization_id', org.id)
      .maybeSingle()
    if (template) {
      const { renderTemplate } = await import('@/lib/inngest/functions')
      bodyHtml = renderTemplate(template.body_html || '', input.fieldValues || {})
    }
  }

  const { data: contract, error } = await supabase
    .from('contracts')
    .insert({
      organization_id: org.id,
      title: input.title.trim(),
      related_entity_type: input.relatedEntityType || null,
      related_entity_id: input.relatedEntityId || null,
      template_id: input.templateId || null,
      body_html: bodyHtml,
      field_values: input.fieldValues || {},
      value_cents: input.valueCents ?? null,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error || !contract) return { ok: false as const, error: error?.message || 'Erro ao criar contrato' }
  await logEvent(supabase, org.id, contract.id, 'contract.created')
  if (bodyHtml) await logEvent(supabase, org.id, contract.id, 'contract.generated')

  revalidatePath(`/app/${orgSlug}/contratos`)
  return { ok: true as const, id: contract.id }
}

export async function updateContractDraft(orgSlug: string, id: string, input: {
  title?: string
  fieldValues?: Record<string, any>
  bodyHtml?: string
  valueCents?: number | null
}) {
  const { org, perm } = await requireContractsAccess(orgSlug)
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  const supabase = createClient()

  // Só rascunho é editável livremente — depois de enviado, o documento
  // assinado (ou em processo) é o registro que vale; editar por baixo
  // corromperia o que já foi/está sendo assinado.
  const { data: current } = await supabase.from('contracts').select('status').eq('id', id).eq('organization_id', org.id).maybeSingle()
  if (!current) return { ok: false as const, error: 'Contrato não encontrado' }
  if (current.status !== 'draft') return { ok: false as const, error: 'Só é possível editar contratos em rascunho.' }

  const updates: Record<string, any> = {}
  if (input.title !== undefined) updates.title = input.title.trim()
  if (input.fieldValues !== undefined) updates.field_values = input.fieldValues
  if (input.bodyHtml !== undefined) updates.body_html = input.bodyHtml
  if (input.valueCents !== undefined) updates.value_cents = input.valueCents

  const { error } = await supabase.from('contracts').update(updates).eq('id', id).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/contratos`)
  revalidatePath(`/app/${orgSlug}/contratos/${id}`)
  return { ok: true as const }
}

export async function cancelContract(orgSlug: string, id: string) {
  const { org, perm } = await requireContractsAccess(orgSlug)
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  const supabase = createClient()

  const { error } = await supabase
    .from('contracts')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  await logEvent(supabase, org.id, id, 'contract.cancelled')

  revalidatePath(`/app/${orgSlug}/contratos`)
  return { ok: true as const }
}

// ── Signatários ──────────────────────────────────────────────────────────────

export async function addContractSigner(orgSlug: string, contractId: string, signer: {
  contatoId?: string | null
  name: string
  email?: string | null
  phone?: string | null
  documentNumber?: string | null
}) {
  const { org, perm } = await requireContractsAccess(orgSlug)
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  if (!signer.name?.trim()) return { ok: false as const, error: 'Informe o nome do signatário.' }
  const supabase = createClient()

  const { count } = await supabase
    .from('contract_signers')
    .select('id', { count: 'exact', head: true })
    .eq('contract_id', contractId)

  const { error } = await supabase.from('contract_signers').insert({
    organization_id: org.id,
    contract_id: contractId,
    contato_id: signer.contatoId || null,
    name: signer.name.trim(),
    email: signer.email || null,
    phone: signer.phone || null,
    document_number: signer.documentNumber || null,
    sort_order: count ?? 0,
  })
  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/contratos/${contractId}`)
  return { ok: true as const }
}

export async function removeContractSigner(orgSlug: string, signerId: string) {
  const { org, perm } = await requireContractsAccess(orgSlug)
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  const supabase = createClient()

  const { error } = await supabase.from('contract_signers').delete().eq('id', signerId).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}
