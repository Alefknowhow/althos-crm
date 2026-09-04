'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'
import { isAccessBlocked } from '@/lib/billing/plans'
import { inngest } from '@/lib/inngest/client'
import { checkContatoPermission, FROZEN_ERROR } from './contatos-shared'
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
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkContatoPermission(org.id, user.id)
  if (!perm.allowed) return { ok: false, error: perm.reason }
  const supabase = createClient()

  if (newStageId === oldStageId) return { ok: true }

  const [{ data: stage }, { data: lead }] = await Promise.all([
    supabase
      .from('pipeline_stages')
      .select('is_won, is_lost')
      .eq('id', newStageId)
      .maybeSingle(),
    supabase
      .from('contatos')
      .select('name, email, phone, value_cents, status, became_customer_at, meta_fbc, meta_fbp, meta_ctwa_clid')
      .eq('id', leadId)
      .eq('organization_id', org.id)
      .maybeSingle(),
  ])

  // Ganhou o negócio → vira cliente automaticamente (antes exigia uma ação
  // manual separada que nada na tela disparava).
  const updates: Record<string, any> = { stage_id: newStageId, updated_at: new Date().toISOString() }
  if (valueCents != null) updates.value_cents = valueCents
  if (stage?.is_won && lead?.status !== 'cliente') {
    updates.status = 'cliente'
    updates.became_customer_at = lead?.became_customer_at || new Date().toISOString()
  }

  // Separa deal_status (aberto/ganho/perdido/desqualificado) do estágio —
  // o board (pipeline/page.tsx) filtra por deal_status='aberto', então isso
  // é o que efetivamente tira o lead do quadro ao fechar.
  const nowIso = new Date().toISOString()
  if (stage?.is_won) {
    updates.deal_status = 'ganho'
    updates.closed_at = nowIso
    updates.close_reason = closeInfo?.reason ?? null
    updates.closed_by = user.id
  } else if (stage?.is_lost) {
    updates.deal_status = closeInfo?.dealStatus ?? 'perdido'
    updates.closed_at = nowIso
    updates.close_reason = closeInfo?.reason ?? 'Motivo não informado'
    updates.closed_by = user.id
  } else {
    // Reabrir: mover pra fora de uma etapa terminal volta o lead pro board.
    updates.deal_status = 'aberto'
    updates.closed_at = null
    updates.close_reason = null
    updates.closed_by = null
  }

  const { error } = await supabase
    .from('contatos')
    .update(updates)
    .eq('id', leadId)
    .eq('organization_id', org.id)

  if (error) return { ok: false, error: error.message }

  // Espelha a mudança no negócio aberto correspondente (fonte de verdade do
  // histórico) — se não houver um por algum motivo (contato criado antes
  // desta tabela existir), cria um agora pra não perder o rastro daqui pra frente.
  const negocioUpdates: Record<string, any> = { stage_id: newStageId, updated_at: new Date().toISOString() }
  if (valueCents != null) negocioUpdates.value_cents = valueCents
  if (stage?.is_won) { negocioUpdates.status = 'won'; negocioUpdates.won_at = new Date().toISOString() }
  else if (stage?.is_lost) { negocioUpdates.status = 'lost'; negocioUpdates.lost_at = new Date().toISOString() }

  const { data: openNegocio } = await supabase
    .from('negocios')
    .select('id')
    .eq('contato_id', leadId)
    .eq('status', 'open')
    .maybeSingle()

  if (openNegocio) {
    await supabase.from('negocios').update(negocioUpdates).eq('id', openNegocio.id)
  } else {
    const { data: contatoRow } = await supabase
      .from('contatos')
      .select('pipeline_id, value_cents')
      .eq('id', leadId)
      .maybeSingle()
    if (contatoRow) {
      await supabase.from('negocios').insert({
        organization_id: org.id,
        contato_id: leadId,
        pipeline_id: contatoRow.pipeline_id,
        stage_id: newStageId,
        value_cents: valueCents ?? (contatoRow.value_cents || 0),
        assigned_to: user.id,
        created_by: user.id,
        ...negocioUpdates,
      })
    }
  }

  await supabase.from('contato_activities').insert({
    contato_id: leadId,
    organization_id: org.id,
    type: 'stage_changed',
    payload: { from: oldStageId, to: newStageId },
    created_by: user.id
  })

  await inngest.send({
    name: 'lead.stage_changed',
    data: { orgId: org.id, leadId, stageId: newStageId }
  })

  // ── Travel niche: auto-create a pre-filled sale when the lead is won ───────
  if (stage?.is_won) {
    const { maybeCreateTravelSaleOnWon } = await import('@/actions/travel-sales')
    await maybeCreateTravelSaleOnWon(supabase, org as any, leadId, user.id)
  }

  // ── Meta CAPI: Purchase (won) or NotQualified (lost) ──────────────────────
  if (stage && (stage.is_won || stage.is_lost) && lead) {
    try {
      const { data: orgMeta } = await supabase
        .from('organizations')
        .select('meta_pixel_id, meta_access_token')
        .eq('id', org.id)
        .maybeSingle()

      if (orgMeta?.meta_pixel_id && orgMeta?.meta_access_token) {
        const { sendCapiEvent } = await import('@/lib/meta/capi')
        await sendCapiEvent({
          pixelId:     orgMeta.meta_pixel_id,
          accessToken: orgMeta.meta_access_token,
          eventName:   stage.is_won ? 'Purchase' : 'NotQualified',
          eventId:     `${leadId}-${stage.is_won ? 'won' : 'lost'}`,
          email:       lead.email,
          phone:       lead.phone,
          firstName:   lead.name,
          fbc:         (lead as any).meta_fbc,
          fbp:         (lead as any).meta_fbp,
          ctwaClid:    (lead as any).meta_ctwa_clid,
          actionSource: (lead as any).meta_ctwa_clid ? 'business_messaging' : 'website',
          ...(stage.is_won && lead.value_cents
            ? { currency: 'BRL', value: lead.value_cents / 100 }
            : {}),
        })
      }
    } catch (capiErr: any) {
      console.error('[moveLeadToStage] CAPI error:', capiErr?.message)
    }
  }

  revalidatePath(`/app/${orgSlug}/pipeline`)
  return { ok: true }
}

export async function getLead(orgSlug: string, leadId: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkContatoPermission(org.id, user.id)
  if (!perm.allowed) return { lead: null, activities: [], automation_runs: [] }
  const supabase = createClient()

  const { data: lead } = await supabase.from('contatos').select('*, pipeline_stages(name)').eq('id', leadId).eq('organization_id', org.id).maybeSingle()
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

