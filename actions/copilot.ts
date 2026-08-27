'use server'

import { getCurrentOrganization } from '@/lib/supabase/types'
import { checkFeatureAccess, getAccountIdForOrgSlug, getAiCreditsStatus } from '@/lib/plans/server'
import { listInsightsSessions, createInsightsSession, deleteInsightsSession, listInsightsMessages } from '@/actions/ai_insights'

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

/** Apaga a sessão atual do copiloto e abre uma nova, vazia — "Limpar conversa". */
export async function clearCopilotConversation(orgSlug: string, sessionId: string | null) {
  if (sessionId) await deleteInsightsSession(orgSlug, sessionId)
  const created = await createInsightsSession(orgSlug)
  if (!created.ok) return { ok: false as const, error: created.error }
  return { ok: true as const, sessionId: created.sessionId }
}
