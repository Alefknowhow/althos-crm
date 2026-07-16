import { getRevenueForecast } from '@/actions/dashboard'
import { listOrgMembers } from '@/actions/sales'
import RevenueForecastCard from './RevenueForecastCard'

/**
 * Server wrapper: fetches the initial forecast (org-wide) + the seller list
 * for the card's own filter dropdown, then hands off to the client card that
 * manages the seller selection and refetches on change.
 */
export default async function RevenueForecastWidget({
  orgId,
  orgSlug,
  pipelineId,
}: {
  orgId: string
  orgSlug: string
  pipelineId: string | null
}) {
  const [forecast, members] = await Promise.all([
    getRevenueForecast(orgId, { pipelineId }),
    listOrgMembers(orgSlug),
  ])

  return (
    <RevenueForecastCard
      orgSlug={orgSlug}
      pipelineId={pipelineId}
      initialForecast={forecast}
      sellers={members.map(m => ({ id: m.id, name: m.name }))}
    />
  )
}
