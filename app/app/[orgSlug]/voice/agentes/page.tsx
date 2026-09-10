import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkFeatureAccessByOrgSlug } from '@/lib/plans/server'
import { VoicePaywall } from '@/components/features/voice/VoicePaywall'
import { listVoiceAgents } from '@/actions/voice'
import { PageHeader } from '@/components/ui/page-header'
import { VoiceAgentsClient } from '@/components/features/voice/VoiceAgentsClient'

export const dynamic = 'force-dynamic'

export default async function VoiceAgentesPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  await getCurrentOrganization(params.orgSlug)
  const allowed = await checkFeatureAccessByOrgSlug(params.orgSlug, 'voice')
  if (!allowed) return <VoicePaywall orgSlug={params.orgSlug} />

  const result = await listVoiceAgents(params.orgSlug)
  const agents = result.ok ? result.agents : []

  return (
    <div className="space-y-6">
      <PageHeader title="Agentes de IA" hint="Configure agentes de Voice AI: identidade, objetivo, modelo e ferramentas permitidas." />
      <VoiceAgentsClient orgSlug={params.orgSlug} initialAgents={agents as any} />
    </div>
  )
}
