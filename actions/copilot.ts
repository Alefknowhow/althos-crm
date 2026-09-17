'use server'

import { getCurrentOrganization } from '@/lib/supabase/types'
import { checkFeatureAccess, getAccountIdForOrgSlug, getAiCreditsStatus } from '@/lib/plans/server'
import { listInsightsSessions, createInsightsSession, deleteInsightsSession, listInsightsMessages } from '@/actions/ai_insights'
import { transcribeAudioElevenLabs } from '@/lib/ai/speech-to-text'

// ~10min de áudio comprimido em webm/opus cabem bem abaixo disso — folga
// generosa sem deixar passar upload absurdo.
const MAX_AUDIO_BYTES = 15 * 1024 * 1024

export type CopilotInit = {
  enabled: boolean
  sessionId: string | null
  messages: any[]
  creditsRemaining: number | null
}

/** Resolve (or create) the copiloto's most recent session + its messages + credit balance. */
export async function getCopilotInit(orgSlug: string): Promise<CopilotInit> {
  const org = await getCurrentOrganization(orgSlug)
  const accountId = (org as any).account_id as string | null

  if (accountId) {
    const enabled = await checkFeatureAccess(accountId, 'ai_insights')
    if (!enabled) return { enabled: false, sessionId: null, messages: [], creditsRemaining: null }
  }

  const sessions = await listInsightsSessions(orgSlug)
  let sessionId = sessions[0]?.id || null
  if (!sessionId) {
    const created = await createInsightsSession(orgSlug)
    if (created.ok) sessionId = created.sessionId
  }

  const messages = sessionId ? await listInsightsMessages(orgSlug, sessionId) : []
  const accountId2 = await getAccountIdForOrgSlug(orgSlug)
  const credits = accountId2 ? await getAiCreditsStatus(accountId2) : null

  return {
    enabled: true,
    sessionId,
    messages,
    creditsRemaining: credits ? credits.available : null,
  }
}

/** Transcreve um áudio gravado no chat do copiloto (ElevenLabs speech-to-text). */
export async function transcribeCopilotAudio(orgSlug: string, formData: FormData) {
  const org = await getCurrentOrganization(orgSlug)
  const accountId = (org as any).account_id as string | null

  if (accountId) {
    const enabled = await checkFeatureAccess(accountId, 'ai_insights')
    if (!enabled) return { ok: false as const, error: 'O copiloto não está disponível no seu plano.' }
  }

  const file = formData.get('audio')
  if (!(file instanceof File)) return { ok: false as const, error: 'Áudio não recebido.' }
  if (file.size === 0) return { ok: false as const, error: 'Áudio vazio.' }
  if (file.size > MAX_AUDIO_BYTES) return { ok: false as const, error: 'Áudio muito longo.' }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const text = await transcribeAudioElevenLabs(buffer, file.name || 'audio.webm', file.type || 'audio/webm')
    return { ok: true as const, text }
  } catch (e: any) {
    return { ok: false as const, error: e?.message || 'Falha ao transcrever áudio.' }
  }
}

/** Apaga a sessão atual do copiloto e abre uma nova, vazia — "Limpar conversa". */
export async function clearCopilotConversation(orgSlug: string, sessionId: string | null) {
  if (sessionId) await deleteInsightsSession(orgSlug, sessionId)
  const created = await createInsightsSession(orgSlug)
  if (!created.ok) return { ok: false as const, error: created.error }
  return { ok: true as const, sessionId: created.sessionId }
}
