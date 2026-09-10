'use server'

import { createLeadCore,deleteLeadCore,updateLeadCore } from '@/lib/services/contatos-leads'
import { getActionContext } from '@/lib/services/context'

import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization,requireAuth } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'
import { checkContatoPermission } from './contatos-shared'

/* =========================================================
 *  Lead CRUD (create/update/delete/notes)
 * ========================================================= */

export async function createLead(orgSlug: string, formData: FormData) {
  return createLeadCore(await getActionContext(orgSlug), formData)
}

export async function addLeadNote(orgSlug: string, leadId: string, formData: FormData) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkContatoPermission(org.id, user.id)
  if (!perm.allowed) return { ok: false, error: perm.reason }
  const supabase = createClient()

  const text = formData.get('text') as string
  if (!text || text.trim() === '') return { ok: false, error: 'Nota vazia' }

  const { data, error } = await supabase.from('contato_activities').insert({
    contato_id: leadId,
    organization_id: org.id,
    type: 'note',
    payload: { text },
    created_by: user.id
  }).select('id, type, payload, created_at, created_by').single()

  if (error) return { ok: false, error: error.message }

  revalidatePath(`/app/${orgSlug}/contatos/${leadId}`)
  return { ok: true, activity: data }
}

/** Registra uma ação de negociação (tentativa de contato, follow-up etc.)
 *  na timeline do lead — igual a addLeadNote, com o campo extra opcional de
 *  data de retorno prevista. */
export async function addNegotiationAction(
  orgSlug: string, leadId: string, text: string, nextReturnDate?: string | null,
) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkContatoPermission(org.id, user.id)
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  const supabase = createClient()

  const trimmed = text.trim()
  if (!trimmed) return { ok: false as const, error: 'Ação vazia' }

  const { data, error } = await supabase.from('contato_activities').insert({
    contato_id: leadId,
    organization_id: org.id,
    type: 'negotiation_action',
    payload: { text: trimmed, next_return_date: nextReturnDate || null },
    created_by: user.id,
  }).select('id, type, payload, created_at, created_by').single()

  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/contatos/${leadId}`)
  return { ok: true as const, activity: data }
}

/** Exclui uma anotação ou ação de negociação criada manualmente — o filtro
 *  de `type` é de propósito: nunca deleta entradas geradas pelo sistema
 *  (stage_changed, whatsapp_sent etc.), só o que o usuário criou aqui. */
export async function deleteContatoActivity(orgSlug: string, activityId: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkContatoPermission(org.id, user.id)
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  const supabase = createClient()

  const { error } = await supabase
    .from('contato_activities')
    .delete()
    .eq('id', activityId)
    .eq('organization_id', org.id)
    .in('type', ['note', 'negotiation_action'])

  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}

/** Lista só as anotações (contato_activities type='note') de um lead — usado
 *  pela aba "Anotações" do painel de detalhes (WhatsApp/Instagram). */
export async function listContatoNotes(orgSlug: string, contatoId: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkContatoPermission(org.id, user.id)
  if (!perm.allowed) return []
  const supabase = createClient()
  const { data } = await supabase
    .from('contato_activities')
    .select('id, payload, created_at, created_by')
    .eq('contato_id', contatoId)
    .eq('organization_id', org.id)
    .eq('type', 'note')
    .order('created_at', { ascending: false })
  return data || []
}


export async function updateLead(orgSlug: string, leadId: string, formData: FormData) {
  return updateLeadCore(await getActionContext(orgSlug), leadId, formData)
}

export async function deleteLead(orgSlug: string, leadId: string) {
  return deleteLeadCore(await getActionContext(orgSlug), leadId)
}

