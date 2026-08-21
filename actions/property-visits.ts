'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { inngest } from '@/lib/inngest/client'
import { revalidatePath } from 'next/cache'

/**
 * Visitas (Vertical Imobiliárias, Fase 2) — ver
 * supabase/migrations/0179_real_estate_interests_visits.sql. Tabela
 * própria (não estende o appointments genérico — ver comentário na
 * migration). Confirmação/lembrete por WhatsApp fica a cargo do motor de
 * automação genérico (lib/inngest/automation.ts), disparado pelos eventos
 * imoveis.visit.* emitidos aqui — nenhuma automação é criada por padrão,
 * a agência configura na tela de Automações como já faz pra Clínicas.
 */

export type PropertyVisitStatus = 'agendada' | 'confirmada' | 'realizada' | 'cancelada' | 'nao_compareceu'

export type PropertyVisitRow = {
  id: string
  property_id: string
  contato_id: string
  broker_user_id: string | null
  scheduled_at: string
  status: PropertyVisitStatus
  notes: string | null
  canceled_reason: string | null
  created_at: string
  property_title: string | null
  property_code: string | null
  contato_name: string | null
}

async function requireAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'imoveis')
  if (!check.allowed) throw new Error(check.reason || 'Sem permissão')
  return { org, user }
}

function mapRow(r: any): PropertyVisitRow {
  return {
    id: r.id, property_id: r.property_id, contato_id: r.contato_id, broker_user_id: r.broker_user_id,
    scheduled_at: r.scheduled_at, status: r.status, notes: r.notes, canceled_reason: r.canceled_reason,
    created_at: r.created_at,
    property_title: r.properties?.title ?? null, property_code: r.properties?.code ?? null,
    contato_name: r.contatos?.name ?? null,
  }
}

export async function listVisitsByContato(orgSlug: string, contatoId: string): Promise<PropertyVisitRow[]> {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('property_visits')
    .select('*, properties(title, code)')
    .eq('organization_id', org.id)
    .eq('contato_id', contatoId)
    .order('scheduled_at', { ascending: false })
  return (data || []).map(mapRow)
}

export async function listVisitsByProperty(orgSlug: string, propertyId: string): Promise<PropertyVisitRow[]> {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('property_visits')
    .select('*, contatos(name)')
    .eq('organization_id', org.id)
    .eq('property_id', propertyId)
    .order('scheduled_at', { ascending: false })
  return (data || []).map(mapRow)
}

export async function scheduleVisit(orgSlug: string, input: {
  propertyId: string; contatoId: string; brokerUserId?: string | null; scheduledAt: string; notes?: string | null
}) {
  const { org, user } = await requireAccess(orgSlug)
  const supabase = createClient()

  const { data: visit, error } = await supabase
    .from('property_visits')
    .insert({
      organization_id: org.id, property_id: input.propertyId, contato_id: input.contatoId,
      broker_user_id: input.brokerUserId ?? null, scheduled_at: input.scheduledAt, notes: input.notes ?? null,
      created_by: user.id,
    })
    .select('id')
    .single()
  if (error || !visit) return { ok: false as const, error: error?.message || 'Erro ao agendar visita' }

  // Tarefa no Core (mesma tabela/fluxo de tarefas, sem sistema paralelo —
  // mesmo padrão de createClinicReturnTask em actions/clinic-returns.ts).
  const [{ data: property }, { data: contato }, { data: column }] = await Promise.all([
    supabase.from('properties').select('title, code').eq('id', input.propertyId).maybeSingle(),
    supabase.from('contatos').select('name').eq('id', input.contatoId).maybeSingle(),
    supabase.from('task_columns').select('id').eq('organization_id', org.id).order('position', { ascending: true }).limit(1).maybeSingle(),
  ])
  const title = `Confirmar visita: ${contato?.name || 'lead'} em ${property?.title || property?.code || 'imóvel'}`
  await supabase.from('tasks').insert({
    organization_id: org.id, contato_id: input.contatoId, title,
    due_date: input.scheduledAt.slice(0, 10), priority: 'normal', status: 'open',
    assigned_to: input.brokerUserId || user.id, column_id: column?.id ?? null,
  })

  // leadId é o nome de campo que o motor genérico de automação
  // (lib/inngest/automation.ts) espera — historicamente "lead", hoje é o
  // id de contatos; propertyId/visitId vão junto como metadata extra
  // (ficam em automation_runs.trigger_payload, disponíveis pro template).
  await inngest.send({
    name: 'imoveis.visit.scheduled',
    data: { orgId: org.id, leadId: input.contatoId, propertyId: input.propertyId, visitId: visit.id },
  })

  revalidatePath(`/app/${orgSlug}/imoveis/${input.propertyId}`)
  revalidatePath(`/app/${orgSlug}/contatos`)
  revalidatePath(`/app/${orgSlug}/tarefas`)
  return { ok: true as const, id: visit.id as string }
}

export async function updateVisitStatus(
  orgSlug: string, id: string, status: PropertyVisitStatus, opts: { canceledReason?: string } = {},
) {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()

  const patch: Record<string, unknown> = { status }
  if (status === 'cancelada') patch.canceled_reason = opts.canceledReason || null

  const { data: visit, error } = await supabase
    .from('property_visits')
    .update(patch)
    .eq('id', id).eq('organization_id', org.id)
    .select('property_id, contato_id')
    .maybeSingle()
  if (error || !visit) return { ok: false as const, error: error?.message || 'Visita não encontrada' }

  const eventByStatus: Partial<Record<PropertyVisitStatus, string>> = {
    confirmada: 'imoveis.visit.confirmed',
    cancelada: 'imoveis.visit.canceled',
    realizada: 'imoveis.visit.completed',
  }
  const eventName = eventByStatus[status]
  if (eventName) {
    await inngest.send({
      name: eventName,
      data: { orgId: org.id, leadId: visit.contato_id, propertyId: visit.property_id, visitId: id },
    })
  }

  revalidatePath(`/app/${orgSlug}/imoveis/${visit.property_id}`)
  revalidatePath(`/app/${orgSlug}/contatos`)
  return { ok: true as const }
}
