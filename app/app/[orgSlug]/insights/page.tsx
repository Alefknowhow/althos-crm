import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import {
  listInsightsSessions,
  listInsightsMessages,
  createInsightsSession,
} from '@/actions/ai_insights'
import { hasPlatformAiKey } from '@/lib/ai/api-key'
import InsightsChat from '@/components/features/ai/InsightsChat'

export const dynamic = 'force-dynamic'

export default async function InsightsPage({
  params,
  searchParams,
}: {
  params: { orgSlug: string }
  searchParams: { session?: string }
}) {
  await requireAuth()
  await getCurrentOrganization(params.orgSlug)

  const sessions = await listInsightsSessions(params.orgSlug)

  // Resolve active session: URL param → most recent → auto-create.
  let activeSessionId = searchParams.session
  if (!activeSessionId || !sessions.find(s => s.id === activeSessionId)) {
    activeSessionId = sessions[0]?.id
  }
  if (!activeSessionId) {
    const created = await createInsightsSession(params.orgSlug)
    if (created.ok) activeSessionId = created.sessionId
  }

  const messages = activeSessionId
    ? await listInsightsMessages(params.orgSlug, activeSessionId)
    : []

  return (
    <InsightsChat
      orgSlug={params.orgSlug}
      hasApiKey={hasPlatformAiKey()}
      sessions={sessions as any[]}
      activeSessionId={activeSessionId || ''}
      initialMessages={messages as any[]}
    />
  )
}
