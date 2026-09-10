'use server'

/**
 * Althos Voice — chamadas. Segue o template padrão de Server Action do CRM:
 * orgSlug → getCurrentOrganization → checkFeatureAccessByOrgSlug('voice') →
 * checkMemberPermission(..., 'voice') → query/insert filtrado por
 * organization_id. Nunca fala com o SDK da Twilio diretamente — só via
 * lib/voice/get-provider.ts (VoiceProvider).
 */

import { revalidatePath } from 'next/cache'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { checkFeatureAccessByOrgSlug, getAccountIdForOrgSlug } from '@/lib/plans/server'
import { checkMemberPermission } from '@/lib/permissions.server'
import { inngest } from '@/lib/inngest/client'

export interface CallFilters {
  direction?: 'inbound' | 'outbound' | 'all'
  humanOrAi?: 'human' | 'ai' | 'all'
  status?: string | 'all'
  contatoId?: string
  search?: string
  page?: number
  pageSize?: number
}

async function guardVoiceAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug) as any
  const allowed = await checkFeatureAccessByOrgSlug(orgSlug, 'voice')
  if (!allowed) return { ok: false as const, error: 'Althos Voice não está disponível no plano atual.' }
  const check = await checkMemberPermission(org.id, user.id, 'voice')
  if (!check.allowed) return { ok: false as const, error: check.reason }
  return { ok: true as const, user, org }
}

/** Inicia uma ligação a partir do CRM (click-to-call) — humana ou Voice AI. */
export async function startCall(orgSlug: string, opts: { contatoId?: string; toNumber: string; fromNumberId: string; aiAgentId?: string }) {
  const guard = await guardVoiceAccess(orgSlug)
  if (!guard.ok) return guard
  const { user, org } = guard

  const supabase = createClient()
  const { data: fromNumber } = await supabase
    .from('voice_numbers')
    .select('e164_number')
    .eq('id', opts.fromNumberId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!fromNumber) return { ok: false as const, error: 'Número de saída inválido.' }

  const { data: call, error } = await supabase
    .from('voice_calls')
    .insert({
      organization_id: org.id,
      contato_id: opts.contatoId ?? null,
      direction: 'outbound',
      human_or_ai: opts.aiAgentId ? 'ai' : 'human',
      ai_agent_id: opts.aiAgentId ?? null,
      user_id: user.id,
      from_number: fromNumber.e164_number,
      to_number: opts.toNumber,
      status: 'queued',
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error || !call) return { ok: false as const, error: error?.message || 'Erro ao criar a chamada.' }

  await inngest.send({ name: 'voice/call.requested', data: { voiceCallId: call.id, organizationId: org.id } })
  revalidatePath(`/app/${orgSlug}/voice/chamadas`)
  return { ok: true as const, voiceCallId: call.id }
}

export async function hangupCall(orgSlug: string, voiceCallId: string) {
  const guard = await guardVoiceAccess(orgSlug)
  if (!guard.ok) return guard
  const { org } = guard

  const admin = createAdminClient()
  const { data: call } = await admin.from('voice_calls').select('provider_call_id').eq('id', voiceCallId).eq('organization_id', org.id).maybeSingle()
  if (!call?.provider_call_id) return { ok: false as const, error: 'Chamada não encontrada.' }

  const { getVoiceProvider } = await import('@/lib/voice/get-provider')
  const provider = await getVoiceProvider(org.id)
  await provider.hangupCall(call.provider_call_id)
  return { ok: true as const }
}

export async function listCalls(orgSlug: string, filters: CallFilters = {}) {
  const guard = await guardVoiceAccess(orgSlug)
  if (!guard.ok) return { ok: false as const, error: guard.error, calls: [], total: 0 }
  const { org } = guard

  const page = filters.page ?? 0
  const pageSize = filters.pageSize ?? 25
  const supabase = createClient()

  let query = supabase
    .from('voice_calls')
    .select('id, contato_id, direction, human_or_ai, user_id, from_number, to_number, status, started_at, ended_at, duration_seconds, outcome, althos_cost_cents, contatos(name)', { count: 'exact' })
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1)

  if (filters.direction && filters.direction !== 'all') query = query.eq('direction', filters.direction)
  if (filters.humanOrAi && filters.humanOrAi !== 'all') query = query.eq('human_or_ai', filters.humanOrAi)
  if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status)
  if (filters.contatoId) query = query.eq('contato_id', filters.contatoId)

  const { data, error, count } = await query
  if (error) return { ok: false as const, error: error.message, calls: [], total: 0 }
  return { ok: true as const, calls: data ?? [], total: count ?? 0 }
}

export async function getCallDetail(orgSlug: string, voiceCallId: string) {
  const guard = await guardVoiceAccess(orgSlug)
  if (!guard.ok) return { ok: false as const, error: guard.error, call: null }
  const { org } = guard

  const supabase = createClient()
  const { data, error } = await supabase
    .from('voice_calls')
    .select('*, contatos(id, name, phone), voice_recordings(id, url, duration_seconds)')
    .eq('id', voiceCallId)
    .eq('organization_id', org.id)
    .maybeSingle()

  if (error || !data) return { ok: false as const, error: error?.message || 'Chamada não encontrada.', call: null }
  return { ok: true as const, call: data }
}

/** Saldo/consumo do dia e do mês, pra o dashboard e o header do módulo. */
export async function getVoiceDashboardSummary(orgSlug: string) {
  const guard = await guardVoiceAccess(orgSlug)
  if (!guard.ok) return { ok: false as const, error: guard.error }
  const { org } = guard

  const supabase = createClient()
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)

  const { data: todayCalls } = await supabase
    .from('voice_calls')
    .select('direction, status, human_or_ai, duration_seconds')
    .eq('organization_id', org.id)
    .gte('created_at', todayStart.toISOString())

  const calls = todayCalls ?? []
  const answered = calls.filter(c => c.status === 'completed' && c.duration_seconds).length
  const totalDuration = calls.reduce((acc, c) => acc + (c.duration_seconds ?? 0), 0)

  const accountId = await getAccountIdForOrgSlug(orgSlug)
  const { getVoiceCreditsStatus } = await import('@/lib/voice/credits')
  const credits = accountId ? await getVoiceCreditsStatus(accountId) : null

  return {
    ok: true as const,
    today: {
      total: calls.length,
      inbound: calls.filter(c => c.direction === 'inbound').length,
      outbound: calls.filter(c => c.direction === 'outbound').length,
      answered,
      missed: calls.filter(c => c.status === 'no_answer' || c.status === 'failed').length,
      aiCalls: calls.filter(c => c.human_or_ai === 'ai').length,
      totalDurationSeconds: totalDuration,
      avgDurationSeconds: answered > 0 ? Math.round(totalDuration / answered) : 0,
    },
    credits,
  }
}
