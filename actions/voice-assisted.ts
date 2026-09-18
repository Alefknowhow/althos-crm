'use server'

/**
 * Althos Voice — chamada assistida (Fase 6). O vendedor liga (humano,
 * `voice_calls.human_or_ai = 'human'`) e acompanha, num chat lateral, a
 * transcrição traduzida em tempo real do outro lado da ligação — gerado
 * pelo mesmo serviço realtime do IA Sales Coach
 * (services/sales-coach-realtime/, reaproveitado aqui com duas rotas novas:
 * `/twilio-media` recebe o Media Stream da Twilio, `/assist-chat` alimenta
 * o painel no browser). Ver lib/sales-coach/realtime-token.ts
 * (signVoiceAssistRealtimeToken) e lib/voice/providers/twilio.ts
 * (startMediaStream).
 *
 * Escopo desta fase: só texto (tradução falada nos dois sentidos ficou de
 * fora por decisão de produto) — não há síntese de voz de volta pra
 * ligação.
 */

import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { checkFeatureAccessByOrgSlug } from '@/lib/plans/server'
import { checkMemberPermission } from '@/lib/permissions.server'
import { hasElevenLabsKey } from '@/lib/ai/api-key'
import {
  hasSalesCoachRealtimeSecret,
  getSalesCoachRealtimeWsUrl,
  signVoiceAssistRealtimeToken,
} from '@/lib/sales-coach/realtime-token'
import { getVoiceProvider } from '@/lib/voice/get-provider'

async function guardVoice(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug) as any
  const allowed = await checkFeatureAccessByOrgSlug(orgSlug, 'voice')
  if (!allowed) return { ok: false as const, error: 'Althos Voice não está disponível no plano atual.' }
  const check = await checkMemberPermission(org.id, user.id, 'voice')
  if (!check.allowed) return { ok: false as const, error: check.reason }
  return { ok: true as const, user, org }
}

export async function startAssistedCallSession(orgSlug: string, voiceCallId: string, targetLanguage: string) {
  const guard = await guardVoice(orgSlug)
  if (!guard.ok) return guard
  const { user, org } = guard

  if (!hasElevenLabsKey()) {
    return { ok: false as const, error: 'ElevenLabs não configurado — chamada assistida indisponível neste ambiente.' }
  }
  if (!hasSalesCoachRealtimeSecret() || !getSalesCoachRealtimeWsUrl()) {
    return { ok: false as const, error: 'Serviço de transcrição em tempo real não está configurado neste ambiente.' }
  }

  const admin = createAdminClient()
  const { data: call } = await admin
    .from('voice_calls')
    .select('id, provider_call_id, status, human_or_ai')
    .eq('id', voiceCallId)
    .eq('organization_id', org.id)
    .maybeSingle()

  if (!call) return { ok: false as const, error: 'Chamada não encontrada.' }
  if (call.human_or_ai !== 'human') return { ok: false as const, error: 'Chamada assistida só se aplica a ligações humanas.' }
  if (!call.provider_call_id || !['ringing', 'in_progress'].includes(call.status)) {
    return { ok: false as const, error: 'A chamada precisa estar em andamento para iniciar o modo assistido.' }
  }

  const supabase = createClient()
  const { data: session, error } = await supabase
    .from('voice_assisted_sessions')
    .insert({
      organization_id: org.id,
      voice_call_id: voiceCallId,
      user_id: user.id,
      target_language: targetLanguage,
      status: 'starting',
    })
    .select('id')
    .single()

  if (error || !session) return { ok: false as const, error: error?.message || 'Não foi possível iniciar a sessão assistida.' }

  const wsBase = getSalesCoachRealtimeWsUrl()
  const mediaToken = signVoiceAssistRealtimeToken({ sessionId: session.id, organizationId: org.id, userId: user.id })
  const chatToken = signVoiceAssistRealtimeToken({ sessionId: session.id, organizationId: org.id, userId: user.id })

  try {
    const provider = await getVoiceProvider(org.id)
    if (!provider.startMediaStream) throw new Error('Provider de voz não suporta chamada assistida.')
    await provider.startMediaStream(call.provider_call_id, `${wsBase}/twilio-media?sessionId=${session.id}&token=${encodeURIComponent(mediaToken)}`)
  } catch (err) {
    await supabase.from('voice_assisted_sessions').update({ status: 'failed' }).eq('id', session.id)
    return { ok: false as const, error: err instanceof Error ? err.message : 'Falha ao anexar o stream de áudio da chamada.' }
  }

  return {
    ok: true as const,
    sessionId: session.id,
    wsUrl: `${wsBase}/assist-chat?sessionId=${session.id}&token=${encodeURIComponent(chatToken)}`,
  }
}

export async function endAssistedCallSession(orgSlug: string, sessionId: string) {
  const guard = await guardVoice(orgSlug)
  if (!guard.ok) return guard
  const { org } = guard

  const supabase = createClient()
  await supabase
    .from('voice_assisted_sessions')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('organization_id', org.id)
    .eq('status', 'live')

  return { ok: true as const }
}

export async function listAssistedTranscript(orgSlug: string, sessionId: string) {
  const guard = await guardVoice(orgSlug)
  if (!guard.ok) return { ok: false as const, error: guard.error, segments: [] }
  const { org } = guard

  const supabase = createClient()
  const { data, error } = await supabase
    .from('voice_assisted_transcript_segments')
    .select('id, speaker, original_text, original_language, translated_text, created_at')
    .eq('organization_id', org.id)
    .eq('session_id', sessionId)
    .order('created_at')

  if (error) return { ok: false as const, error: error.message, segments: [] }
  return { ok: true as const, segments: data ?? [] }
}
