'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization, isImpersonating } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'
import { isAccessBlocked } from '@/lib/billing/plans'
import { checkContatoPermission, FROZEN_ERROR } from './contatos-shared'

/* =========================================================
 *  Deals: mark/unmark as customer, list deals, reopen negotiation
 * ========================================================= */

export async function markAsCustomer(orgSlug: string, leadId: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkContatoPermission(org.id, user.id)
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  const supabase = createClient()
  const { error } = await supabase
    .from('contatos')
    .update({ status: 'cliente', became_customer_at: new Date().toISOString() })
    .eq('id', leadId)
    .eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/contatos`)
  return { ok: true as const }
}

export async function unmarkAsCustomer(orgSlug: string, leadId: string) {
  if (isImpersonating()) {
    return { ok: false as const, error: 'Ações destrutivas não são permitidas em modo de impersonação.' }
  }
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkContatoPermission(org.id, user.id)
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  const supabase = createClient()
  const { error } = await supabase
    .from('contatos')
    .update({ status: 'lead', became_customer_at: null })
    .eq('id', leadId)
    .eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/contatos`)
  return { ok: true as const }
}

export type ContatoDeal = {
  id: string
  status: 'open' | 'won' | 'lost'
  stage_name: string | null
  value_cents: number | null
  won_at: string | null
  lost_at: string | null
  created_at: string
}

/** Histórico completo de negócios do contato (fonte: tabela `negocios`). */
export async function listContatoDeals(orgSlug: string, contatoId: string): Promise<ContatoDeal[]> {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkContatoPermission(org.id, user.id)
  if (!perm.allowed) return []
  const supabase = createClient()
  const { data } = await supabase
    .from('negocios')
    .select('id, status, value_cents, won_at, lost_at, created_at, pipeline_stages(name)')
    .eq('contato_id', contatoId)
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })
  return (data || []).map((d: any) => ({
    id: d.id,
    status: d.status,
    stage_name: d.pipeline_stages?.name ?? null,
    value_cents: d.value_cents,
    won_at: d.won_at,
    lost_at: d.lost_at,
    created_at: d.created_at,
  }))
}

/**
 * "Nova negociação" — pro cliente que já comprou antes e voltou. Segue o
 * mesmo conceito usado por CRMs grandes (Salesforce/HubSpot): negócio é uma
 * entidade própria, e um contato pode ter vários ao longo do tempo. O
 * negócio anterior (ganho) permanece intacto na tabela `negocios` — cria-se
 * um novo negócio aberto do zero, e o card do contato no Kanban passa a
 * espelhar esse novo negócio (volta pra primeira etapa, valor zerado). O
 * contato continua classificado como "cliente" — ele só está comprando de
 * novo, não deixou de ser cliente.
 */
export async function reopenNegotiation(orgSlug: string, contatoId: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkContatoPermission(org.id, user.id)
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  if (isAccessBlocked(org as any)) return { ok: false as const, error: FROZEN_ERROR }
  const supabase = createClient()

  const { data: contato } = await supabase
    .from('contatos')
    .select('pipeline_id, status')
    .eq('id', contatoId)
    .eq('organization_id', org.id)
    .maybeSingle()

  if (!contato) return { ok: false as const, error: 'Contato não encontrado.' }
  if (contato.status !== 'cliente') {
    return { ok: false as const, error: 'Só é possível reabrir negociação para quem já é cliente.' }
  }

  const { data: firstStage } = await supabase
    .from('pipeline_stages')
    .select('id')
    .eq('pipeline_id', contato.pipeline_id)
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!firstStage) return { ok: false as const, error: 'Pipeline sem etapas configuradas.' }

  // Fecha qualquer negócio ainda aberto (não deveria haver, mas por
  // segurança — o índice único só permite 1 aberto por contato).
  await supabase.from('negocios')
    .update({ status: 'lost', lost_at: new Date().toISOString() })
    .eq('contato_id', contatoId)
    .eq('status', 'open')

  const { error: insertError } = await supabase.from('negocios').insert({
    organization_id: org.id,
    contato_id: contatoId,
    pipeline_id: contato.pipeline_id,
    stage_id: firstStage.id,
    value_cents: 0,
    status: 'open',
    assigned_to: user.id,
    created_by: user.id,
  })
  if (insertError) return { ok: false as const, error: insertError.message }

  const { error } = await supabase
    .from('contatos')
    .update({ stage_id: firstStage.id, value_cents: 0, updated_at: new Date().toISOString() })
    .eq('id', contatoId)
    .eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }

  await supabase.from('contato_activities').insert({
    contato_id: contatoId,
    organization_id: org.id,
    type: 'negotiation_reopened',
    payload: {},
    created_by: user.id,
  })

  revalidatePath(`/app/${orgSlug}/contatos`)
  revalidatePath(`/app/${orgSlug}/contatos/${contatoId}`)
  revalidatePath(`/app/${orgSlug}/pipeline`)
  return { ok: true as const }
}

