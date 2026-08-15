import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import {
  getAttendantConfig,
  listKnowledge,
  listSandboxSessions,
  listSandboxMessages,
  createSandboxSession,
} from '@/actions/ai_attendant'
import { getOrgAIConfig } from '@/actions/organization'
import { hasPlatformAiKey } from '@/lib/ai/api-key'
import { checkFeatureAccessByOrgSlug } from '@/lib/plans/server'
import UpgradeGate from '@/components/features/billing/UpgradeGate'
import AgenteIaTabs from '@/components/features/ai/AgenteIaTabs'

export const dynamic = 'force-dynamic'

const VALID_TABS = ['personalidade', 'qualificacao', 'conhecimento', 'fluxos', 'horarios', 'transferencia', 'ferramentas', 'memoria', 'testar']

export default async function AgenteIaPage({
  params,
  searchParams,
}: {
  params: { orgSlug: string }
  searchParams: { session?: string; tab?: string }
}) {
  await requireAuth()
  await getCurrentOrganization(params.orgSlug)

  const hasAccess = await checkFeatureAccessByOrgSlug(params.orgSlug, 'ai_attendant')

  const [config, knowledge, sessions, qualifier] = await Promise.all([
    getAttendantConfig(params.orgSlug),
    listKnowledge(params.orgSlug),
    listSandboxSessions(params.orgSlug),
    getOrgAIConfig(params.orgSlug),
  ])

  let activeSessionId = searchParams.session
  if (!activeSessionId || !sessions.find(s => s.id === activeSessionId)) {
    activeSessionId = sessions[0]?.id
  }
  if (!activeSessionId) {
    const created = await createSandboxSession(params.orgSlug)
    if (created.ok) activeSessionId = created.sessionId
  }

  const initialMessages = activeSessionId
    ? await listSandboxMessages(params.orgSlug, activeSessionId)
    : []

  return (
    <UpgradeGate locked={!hasAccess} orgSlug={params.orgSlug} featureName="Agente de IA">
      <AgenteIaTabs
        orgSlug={params.orgSlug}
        initial={config}
        knowledge={knowledge}
        qualifier={qualifier}
        sandbox={{
          hasApiKey: hasPlatformAiKey(),
          sessions: sessions as any[],
          activeSessionId: activeSessionId || '',
          initialMessages: initialMessages as any[],
        }}
        defaultTab={VALID_TABS.includes(searchParams.tab || '') ? searchParams.tab : undefined}
      />
    </UpgradeGate>
  )
}
