import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import {
  getAttendantConfig,
  listKnowledge,
  listSandboxSessions,
  listSandboxMessages,
  createSandboxSession,
} from '@/actions/ai_attendant'
import { hasPlatformAiKey } from '@/lib/ai/api-key'
import { checkFeatureAccessByOrgSlug } from '@/lib/plans/server'
import UpgradeGate from '@/components/features/billing/UpgradeGate'
import AgenteIaTabs from '@/components/features/ai/AgenteIaTabs'
import SettingsTabsNav from '../SettingsTabsNav'

export const dynamic = 'force-dynamic'

const VALID_TABS = ['personalidade', 'conhecimento', 'fluxos', 'horarios', 'transferencia', 'ferramentas', 'memoria', 'testar']

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

  const [config, knowledge, sessions] = await Promise.all([
    getAttendantConfig(params.orgSlug),
    listKnowledge(params.orgSlug),
    listSandboxSessions(params.orgSlug),
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
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Gerencie sua conta, organizações, membros e integrações.</p>
      </div>

      <SettingsTabsNav orgSlug={params.orgSlug} />

      <UpgradeGate locked={!hasAccess} orgSlug={params.orgSlug} featureName="Agente de IA">
        <AgenteIaTabs
          orgSlug={params.orgSlug}
          initial={config}
          knowledge={knowledge}
          sandbox={{
            hasApiKey: hasPlatformAiKey(),
            sessions: sessions as any[],
            activeSessionId: activeSessionId || '',
            initialMessages: initialMessages as any[],
          }}
          defaultTab={VALID_TABS.includes(searchParams.tab || '') ? searchParams.tab : undefined}
        />
      </UpgradeGate>
    </div>
  )
}
