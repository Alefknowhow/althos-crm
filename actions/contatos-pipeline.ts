'use server'

import { moveLeadToStageCore } from '@/lib/services/contatos-pipeline'
import { getActionContext } from '@/lib/services/context'

import { isAccessBlocked } from '@/lib/billing/plans'
import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization,requireAuth } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'
import { checkContatoPermission,FROZEN_ERROR } from './contatos-shared'
import { listOrgMembers } from './team'

/* =========================================================
 *  Pipeline / stage movement, assignment, value, tags, qualification
 * ========================================================= */

export async function moveLeadToStage(
  orgSlug: string,
  leadId: string,
  newStageId: string,
  oldStageId: string,
  /** Só relevante ao entrar numa etapa is_lost — distingue perdido de
   * desqualificado e registra o motivo. Se omitido ao cair numa etapa
   * is_lost, assume 'perdido' com motivo genérico (fallback — nunca bloqueia
   * o drag-and-drop por falta dessa informação). */
  closeInfo?: { dealStatus: 'perdido' | 'desqualificado'; reason: string },
  /** Valor em centavos a gravar junto com a mudança de etapa — usado ao
   * entrar em "Negociação" (valor sendo negociado) ou numa etapa is_won
   * (valor final da conversão, que pode ter mudado durante a negociação). */
  valueCents?: number,
) {
  return moveLeadToStageCore(await getActionContext(orgSlug), leadId, newStageId, oldStageId, closeInfo, valueCents)
}

export async function getLead(orgSlug: string, leadId: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkContatoPermission(org.id, user.id)
  if (!perm.allowed) return { lead: null, activities: [], automation_runs: [] }
  const supabase = createClient()

  const { data: lead } = await supabase.from('contatos').select('*, pipeline_stages(name), origin_campaign:campaigns!meta_resolved_campaign_id(name), origin_tracking:tracking_links!tracking_link_id(label, campaign:campaigns!campaign_id(name))').eq('id', leadId).eq('organization_id', org.id).maybeSingle()
  const { data: activitiesRaw } = await supabase.from('contato_activities').select('*').eq('contato_id', leadId).order('created_at', { ascending: false })
  const { data: automation_runs } = await supabase.from('automation_runs').select('*, automations(name)').eq('contato_id', leadId).order('started_at', { ascending: false })

  // Resolve created_by -> nome do membro, pra timeline mostrar quem fez
  // cada ação (o dado já era gravado, só não era exibido).
  const members = await listOrgMembers(orgSlug)
  const memberNameById = new Map(members.map(m => [m.user_id, m.name || m.email]))
  const activities = (activitiesRaw || []).map(a => ({
    ...a,
    created_by_name: a.created_by ? (memberNameById.get(a.created_by) || null) : null,
  }))

  return { lead, activities, automation_runs, members }
}

export async function assignLead(orgSlug: string, leadId: string, userId: string | null) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkContatoPermission(org.id, user.id)
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  const supabase = createClient()

  const { error } = await supabase
    .from('contatos')
    .update({ assigned_to: userId })
    .eq('id', leadId)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/pipeline`)
  revalidatePath(`/app/${orgSlug}/contatos/${leadId}`)
  return { ok: true as const }
}

export async function updateLeadValue(orgSlug: string, leadId: string, valueCents: number) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkContatoPermission(org.id, user.id)
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  if (isAccessBlocked(org as any)) return { ok: false as const, error: FROZEN_ERROR }
  const supabase = createClient()

  const { error } = await supabase
    .from('contatos')
    .update({ value_cents: valueCents || null })
    .eq('id', leadId)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/pipeline`)
  return { ok: true as const }
}

export async function updateLeadTags(orgSlug: string, leadId: string, tags: string[]) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkContatoPermission(org.id, user.id)
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  if (isAccessBlocked(org as any)) return { ok: false as const, error: FROZEN_ERROR }
  const supabase = createClient()

  const clean = Array.from(new Set(
    (tags || [])
      .map(t => String(t).trim())
      .filter(Boolean)
      .map(t => t.slice(0, 40)),
  )).slice(0, 20)

  const { error } = await supabase
    .from('contatos')
    .update({ tags: clean })
    .eq('id', leadId)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/pipeline`)
  revalidatePath(`/app/${orgSlug}/contatos/${leadId}`)
  return { ok: true as const, tags: clean }
}

/**
 * Observações internas — campo livre editável direto no perfil, substitui o
 * antigo mecanismo de "Adicionar Nota" (popup + timeline de atividades).
 */
export async function updateContatoInternalNotes(orgSlug: string, contatoId: string, text: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkContatoPermission(org.id, user.id)
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  if (isAccessBlocked(org as any)) return { ok: false as const, error: FROZEN_ERROR }
  const supabase = createClient()

  const { error } = await supabase
    .from('contatos')
    .update({ internal_notes: text || null })
    .eq('id', contatoId)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/contatos/${contatoId}`)
  revalidatePath(`/app/${orgSlug}/contatos`)
  return { ok: true as const }
}

export async function requestLeadQualification(orgSlug: string, leadId: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkContatoPermission(org.id, user.id)
  if (!perm.allowed) return { ok: false as const, reason: perm.reason || 'Sem permissão' }

  const { runLeadQualification } = await import('@/lib/ai/run-qualification')
  const result = await runLeadQualification(leadId, org.id, null)

  if (result.ok) {
    revalidatePath(`/app/${orgSlug}/contatos/${leadId}`)
  }

  return result
}

