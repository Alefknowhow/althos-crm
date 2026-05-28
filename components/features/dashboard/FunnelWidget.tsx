import { getFunnelData } from '@/actions/dashboard'
import ConversionFunnel from './ConversionFunnel'

export default async function FunnelWidget({
  orgId,
  pipelineId,
}: {
  orgId: string
  pipelineId?: string | null
}) {
  const data = await getFunnelData(orgId, pipelineId)
  return <ConversionFunnel data={data} />
}
