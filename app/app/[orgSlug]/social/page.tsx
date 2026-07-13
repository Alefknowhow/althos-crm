import { getSocialAutomations, getSocialConnections, getSocialInteractions } from '@/actions/social-automations'
import { getFunnels } from '@/actions/social-funnels'
import { SocialPageClient } from './SocialPageClient'

export const dynamic = 'force-dynamic'

export default async function SocialPage({ params }: { params: { orgSlug: string } }) {
  const [automations, connections, interactions, funnels] = await Promise.all([
    getSocialAutomations(params.orgSlug).catch(() => []),
    getSocialConnections(params.orgSlug).catch(() => []),
    getSocialInteractions(params.orgSlug, 30).catch(() => []),
    getFunnels(params.orgSlug).catch(() => []),
  ])

  return (
    <SocialPageClient
      orgSlug={params.orgSlug}
      initialAutomations={automations}
      initialConnections={connections}
      initialInteractions={interactions}
      initialFunnels={funnels}
    />
  )
}
