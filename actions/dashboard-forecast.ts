'use server'

import { getCurrentOrganization } from '@/lib/supabase/types'
import { getRevenueForecast as _getRevenueForecast, type RevenueForecast } from './dashboard'

/** Client-callable wrapper so RevenueForecastWidget can refetch on seller change without a full page reload. */
export async function fetchRevenueForecast(
  orgSlug: string,
  filters: { pipelineId: string | null; sellerId: string | null },
): Promise<RevenueForecast> {
  const org = await getCurrentOrganization(orgSlug)
  return _getRevenueForecast(org.id, filters)
}
