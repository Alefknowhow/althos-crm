'use server'

/**
 * Revisão interna das conversões manuais reportadas pelo cliente no Portal
 * (issue #27/#61, passo 2.5) — "o portal é complemento, não segunda fonte
 * conflitante": a agência confirma (`validated_at`/`validated_by`) antes de
 * a conversão entrar em relatórios. Só ao **validar** uma conversão do tipo
 * `venda` (nunca ao só registrar — evita o cliente disparar Purchase direto
 * na Meta) o CAPI é notificado, usando o pipeline default da org que tiver
 * pixel configurado; sem isso, não envia e registra o motivo no log.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { inngest } from '@/lib/inngest/client'
import type { PortalConversion } from '@/actions/client-portal-data'

async function requireAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'trafego')
  if (!check.allowed) throw new Error(check.reason || 'Sem permissão')
  return { org, user }
}

export type ClientPortalConversion = PortalConversion & { validatedAt: string | null; validatedBy: string | null }

export async function listClientPortalConversions(orgSlug: string, contatoId: string): Promise<ClientPortalConversion[]> {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('portal_conversions')
    .select('id, type, value_cents, occurred_at, note, created_at, validated_at, validated_by')
    .eq('organization_id', org.id)
    .eq('contato_id', contatoId)
    .order('occurred_at', { ascending: false })
  return (data || []).map((r: any) => ({
    id: r.id, type: r.type, valueCents: r.value_cents, occurredAt: r.occurred_at, note: r.note, createdAt: r.created_at,
    validatedAt: r.validated_at, validatedBy: r.validated_by,
  }))
}

export async function validatePortalConversion(orgSlug: string, contatoId: string, conversionId: string) {
  const { org, user } = await requireAccess(orgSlug)
  const supabase = createClient()

  const { data: conversion } = await supabase
    .from('portal_conversions')
    .select('id, type, value_cents, contato_id, validated_at')
    .eq('id', conversionId)
    .eq('organization_id', org.id)
    .eq('contato_id', contatoId)
    .maybeSingle()
  if (!conversion) return { ok: false as const, error: 'Conversão não encontrada.' }
  if (conversion.validated_at) return { ok: true as const }

  const { error } = await supabase
    .from('portal_conversions')
    .update({ validated_at: new Date().toISOString(), validated_by: user.id })
    .eq('id', conversionId)
  if (error) return { ok: false as const, error: error.message }

  await inngest.send({ name: 'trafego.conversion.reported', data: { orgId: org.id, leadId: contatoId, conversionId } })

  if (conversion.type === 'venda') {
    const { data: lead } = await supabase.from('contatos').select('email, phone, name').eq('id', contatoId).maybeSingle()
    const { data: pipeline } = await supabase
      .from('pipelines')
      .select('id, meta_pixel_id, meta_access_token')
      .eq('organization_id', org.id)
      .eq('is_default', true)
      .maybeSingle()

    if (pipeline?.meta_pixel_id && pipeline?.meta_access_token && lead) {
      const { sendCapiEventLogged } = await import('@/lib/meta/capi')
      await sendCapiEventLogged({
        pixelId: pipeline.meta_pixel_id,
        accessToken: pipeline.meta_access_token,
        eventName: 'Purchase',
        eventId: `portal-conv-${conversionId}`,
        email: lead.email,
        phone: lead.phone,
        firstName: lead.name,
        ...(conversion.value_cents ? { currency: 'BRL', value: conversion.value_cents / 100 } : {}),
      }, { supabase, organizationId: org.id, pipelineId: pipeline.id, contatoId, source: 'portal_conversion' })
    } else {
      // Sem pipeline default com pixel — registra o motivo em vez de
      // silenciosamente não enviar (checkpoint da spec 2.5).
      await supabase.from('capi_event_log').insert({
        organization_id: org.id,
        contato_id: contatoId,
        event_name: 'Purchase',
        event_id: `portal-conv-${conversionId}`,
        status: 'failed',
        error: 'sem pixel configurado no pipeline default',
        source: 'portal_conversion',
      })
    }
  }

  return { ok: true as const }
}
