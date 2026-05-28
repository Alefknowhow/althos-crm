import { inngest } from './client'
import { runLeadQualification } from '@/lib/ai/run-qualification'

/**
 * AI lead qualifier — triggered by `lead.qualify_requested` event.
 * Delegates to runLeadQualification() which is also used by the direct server action.
 */
export const qualifyLeadFn = inngest.createFunction(
  {
    id: 'ai-qualify-lead',
    retries: 2,
    triggers: [{ event: 'lead.qualify_requested' }],
  },
  async ({ event }) => {
    const { leadId, orgId, formId } = event.data as {
      leadId: string
      orgId: string
      formId?: string | null
    }

    if (!leadId || !orgId) return { skipped: 'missing leadId/orgId' }

    const result = await runLeadQualification(leadId, orgId, formId)
    return result
  },
)
