'use server'

import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import { checkMemberPermission } from '@/lib/permissions.server'
import { checkFeatureAccess, getAccountIdForOrgSlug, getAiCreditsStatus } from '@/lib/plans/server'
import { createFinancialEntry } from '@/actions/financial'

export type FinancialAiInit = {
  enabled: boolean
  sessionId: string | null
  messages: any[]
  creditsRemaining: number | null
}

export async function getFinancialAiInit(orgSlug: string): Promise<FinancialAiInit> {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'financial')
  if (!perm.allowed) return { enabled: false, sessionId: null, messages: [], creditsRemaining: null }

  const accountId = (org as any).account_id as string | null
  if (accountId) {
    const allowed = await checkFeatureAccess(accountId, 'ai_insights')
    if (!allowed) return { enabled: false, sessionId: null, messages: [], creditsRemaining: null }
  }

  const supabase = createClient()
  const { data: sessions } = await supabase
    .from('ai_financial_sessions')
    .select('id')
    .eq('organization_id', org.id)
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(1)

  let sessionId = sessions?.[0]?.id || null
  if (!sessionId) {
    const { data: created } = await supabase
      .from('ai_financial_sessions')
      .insert({ organization_id: org.id, user_id: user.id })
      .select('id')
      .maybeSingle()
    sessionId = created?.id || null
  }

  const { data: messages } = sessionId
    ? await supabase
        .from('ai_financial_messages')
        .select('id, role, content, tool_calls, created_at')
        .eq('session_id', sessionId)
        .eq('organization_id', org.id)
        .order('created_at', { ascending: true })
    : { data: [] }

  const accountId2 = await getAccountIdForOrgSlug(orgSlug)
  const credits = accountId2 ? await getAiCreditsStatus(accountId2) : null

  return {
    enabled: true,
    sessionId,
    messages: messages || [],
    creditsRemaining: credits ? credits.available : null,
  }
}

/**
 * Confirms a draft proposed by the AI (propor_lancamento tool) and actually
 * writes it. Client-triggered only — called from the "Confirmar" button in
 * the chat UI, never invoked by the model itself.
 */
export async function confirmFinancialAiEntry(orgSlug: string, draft: Record<string, any>) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'financial')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const res = await createFinancialEntry(orgSlug, draft)
  return res
}
