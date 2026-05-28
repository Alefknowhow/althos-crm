import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import {
  getAttendantConfig,
  listSandboxSessions,
  listSandboxMessages,
  createSandboxSession,
} from '@/actions/ai_attendant'
import { getOrgAIConfig } from '@/actions/organization'
import SandboxPlayground from '@/components/features/ai/SandboxPlayground'

export const dynamic = 'force-dynamic'

export default async function PlaygroundPage({
  params,
  searchParams,
}: {
  params: { orgSlug: string }
  searchParams: { session?: string }
}) {
  await requireAuth()
  await getCurrentOrganization(params.orgSlug)

  const [config, sessions, orgAi] = await Promise.all([
    getAttendantConfig(params.orgSlug),
    listSandboxSessions(params.orgSlug),
    getOrgAIConfig(params.orgSlug),
  ])

  // Pick session: requested via URL, latest existing, or create a new one.
  let activeSessionId = searchParams.session
  if (!activeSessionId || !sessions.find(s => s.id === activeSessionId)) {
    activeSessionId = sessions[0]?.id
  }
  if (!activeSessionId) {
    const created = await createSandboxSession(params.orgSlug)
    if (created.ok) activeSessionId = created.sessionId
  }

  const messages = activeSessionId
    ? await listSandboxMessages(params.orgSlug, activeSessionId)
    : []

  return (
    <SandboxPlayground
      orgSlug={params.orgSlug}
      hasApiKey={orgAi.has_api_key}
      attendantEnabled={config.is_enabled}
      sessions={sessions as any[]}
      activeSessionId={activeSessionId || ''}
      initialMessages={messages as any[]}
    />
  )
}
