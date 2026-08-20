'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'
import type { ClinicQuoteStatus } from '@/lib/clinic-constants'

/**
 * Vertical Clínicas — Fase 4: Orçamentos. Paciente = contatos (Core).
 * Ver supabase/migrations/0166_clinic_quotes.sql.
 */

async function requireOrcamentosAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'orcamentos_clinica')
  if (!check.allowed) throw new Error(check.reason || 'Sem permissão')
  return { org, user }
}

export type ClinicQuoteItemInput = {
  event_type_id: string | null
  description: string
  quantity: number
  unit_price_cents: number
}

export type ClinicQuoteListRow = {
  id: string
  status: ClinicQuoteStatus
  patient_contato_id: string
  patient_name: string
  professional_id: string | null
  total_cents: number
  valid_until: string | null
  created_at: string
}

export async function listClinicQuotes(orgSlug: string): Promise<ClinicQuoteListRow[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('clinic_quotes')
    .select('id, status, patient_contato_id, professional_id, valid_until, created_at, contatos(name), clinic_quote_items(quantity, unit_price_cents)')
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })
    .limit(200)

  return (data || []).map((q: any) => ({
    id: q.id,
    status: q.status,
    patient_contato_id: q.patient_contato_id,
    patient_name: q.contatos?.name || 'Contato removido',
    professional_id: q.professional_id,
    total_cents: (q.clinic_quote_items || []).reduce((a: number, it: any) => a + it.quantity * it.unit_price_cents, 0),
    valid_until: q.valid_until,
    created_at: q.created_at,
  }))
}

export type ClinicQuoteDetail = ClinicQuoteListRow & {
  discount_cents: number
  notes: string | null
  items: (ClinicQuoteItemInput & { id: string })[]
}

export async function getClinicQuote(orgSlug: string, id: string): Promise<ClinicQuoteDetail | null> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data: q } = await supabase
    .from('clinic_quotes')
    .select('id, status, patient_contato_id, professional_id, valid_until, created_at, discount_cents, notes, contatos(name)')
    .eq('id', id)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!q) return null

  const { data: items } = await supabase
    .from('clinic_quote_items')
    .select('id, event_type_id, description, quantity, unit_price_cents')
    .eq('quote_id', id)
    .order('position', { ascending: true })

  const total = (items || []).reduce((a, it) => a + it.quantity * it.unit_price_cents, 0)

  return {
    id: q.id,
    status: q.status as ClinicQuoteStatus,
    patient_contato_id: q.patient_contato_id,
    patient_name: (q as any).contatos?.name || 'Contato removido',
    professional_id: q.professional_id,
    total_cents: total,
    valid_until: q.valid_until,
    created_at: q.created_at,
    discount_cents: q.discount_cents,
    notes: q.notes,
    items: (items || []).map(it => ({
      id: it.id,
      event_type_id: it.event_type_id,
      description: it.description,
      quantity: it.quantity,
      unit_price_cents: it.unit_price_cents,
    })),
  }
}

export type ClinicQuoteInput = {
  patient_contato_id: string
  professional_id: string | null
  valid_until: string | null
  discount_cents: number
  notes: string | null
  items: ClinicQuoteItemInput[]
}

export async function createClinicQuote(orgSlug: string, input: ClinicQuoteInput) {
  const { org, user } = await requireOrcamentosAccess(orgSlug)
  if (!input.patient_contato_id) return { ok: false as const, error: 'Selecione o paciente.' }
  if (input.items.length === 0) return { ok: false as const, error: 'Adicione ao menos um item.' }
  const supabase = createClient()

  const { data: quote, error } = await supabase
    .from('clinic_quotes')
    .insert({
      organization_id: org.id,
      patient_contato_id: input.patient_contato_id,
      professional_id: input.professional_id || null,
      valid_until: input.valid_until || null,
      discount_cents: input.discount_cents || 0,
      notes: input.notes || null,
      created_by: user.id,
      status: 'rascunho',
    })
    .select('id')
    .maybeSingle()
  if (error || !quote) return { ok: false as const, error: error?.message || 'Erro ao criar orçamento' }

  const { error: itemsError } = await supabase.from('clinic_quote_items').insert(
    input.items.map((it, idx) => ({
      quote_id: quote.id,
      event_type_id: it.event_type_id || null,
      description: it.description,
      quantity: it.quantity,
      unit_price_cents: it.unit_price_cents,
      position: idx,
    })),
  )
  if (itemsError) return { ok: false as const, error: itemsError.message }

  revalidatePath(`/app/${orgSlug}/orcamentos`)
  return { ok: true as const, id: quote.id as string }
}

export async function updateClinicQuote(orgSlug: string, id: string, input: ClinicQuoteInput) {
  await requireOrcamentosAccess(orgSlug)
  const org = await getCurrentOrganization(orgSlug)
  if (!input.patient_contato_id) return { ok: false as const, error: 'Selecione o paciente.' }
  if (input.items.length === 0) return { ok: false as const, error: 'Adicione ao menos um item.' }
  const supabase = createClient()

  const { error } = await supabase
    .from('clinic_quotes')
    .update({
      patient_contato_id: input.patient_contato_id,
      professional_id: input.professional_id || null,
      valid_until: input.valid_until || null,
      discount_cents: input.discount_cents || 0,
      notes: input.notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }

  // Full-replace dos itens — mais simples que reconciliar diffs, e o
  // volume por orçamento é pequeno.
  await supabase.from('clinic_quote_items').delete().eq('quote_id', id)
  const { error: itemsError } = await supabase.from('clinic_quote_items').insert(
    input.items.map((it, idx) => ({
      quote_id: id,
      event_type_id: it.event_type_id || null,
      description: it.description,
      quantity: it.quantity,
      unit_price_cents: it.unit_price_cents,
      position: idx,
    })),
  )
  if (itemsError) return { ok: false as const, error: itemsError.message }

  revalidatePath(`/app/${orgSlug}/orcamentos`)
  return { ok: true as const }
}

export async function deleteClinicQuote(orgSlug: string, id: string) {
  const org = await getCurrentOrganization(orgSlug)
  await requireOrcamentosAccess(orgSlug)
  const supabase = createClient()
  const { error } = await supabase.from('clinic_quotes').delete().eq('id', id).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/orcamentos`)
  return { ok: true as const }
}

/** Transições de status — rascunho→enviado→visualizado→aprovado, com
 *  recusado/expirado/cancelado como saídas alternativas. Não força uma
 *  ordem estrita (o operador pode, por exemplo, marcar "recusado" direto de
 *  "enviado") — só carimba o timestamp correspondente quando existir. */
export async function setClinicQuoteStatus(orgSlug: string, id: string, status: ClinicQuoteStatus) {
  const org = await getCurrentOrganization(orgSlug)
  await requireOrcamentosAccess(orgSlug)
  const supabase = createClient()

  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (status === 'enviado') patch.sent_at = new Date().toISOString()
  if (status === 'visualizado') patch.viewed_at = new Date().toISOString()
  if (status === 'aprovado') patch.approved_at = new Date().toISOString()

  const { error } = await supabase.from('clinic_quotes').update(patch).eq('id', id).eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/orcamentos`)
  return { ok: true as const }
}
