'use server'

/**
 * Funnel-specific server actions, separated from actions/dashboard.ts so
 * client components can call them via useTransition (the dashboard.ts file
 * isn't marked 'use server' because it exports helpers).
 *
 * Actual query logic lives in actions/dashboard.ts and is re-exported here
 * to avoid duplication.
 */

import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import {
  getAdvancedFunnel as _getAdvancedFunnel,
  getFunnelSourceOptions as _getFunnelSourceOptions,
  type FunnelPeriod,
  type FunnelSource,
  type FunnelResult,
} from './dashboard'

export type { FunnelPeriod, FunnelSource, FunnelResult } from './dashboard'

/**
 * Server action wrapper around getAdvancedFunnel. Takes orgSlug (client
 * doesn't know org id) and re-validates auth + org membership before
 * dispatching to the shared query implementation.
 */
export async function fetchFunnel(
  orgSlug: string,
  filters: { period: FunnelPeriod; source: FunnelSource; pipelineId: string | null },
): Promise<FunnelResult> {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  return _getAdvancedFunnel(org.id, filters)
}

export async function fetchFunnelSourceOptions(orgSlug: string) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  return _getFunnelSourceOptions(org.id)
}
