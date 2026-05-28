import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { sendEmail, importLeadsCsv } from '@/lib/inngest/functions'
import { processAutomationEvent, executeAutomationRun } from '@/lib/inngest/automation'
import { qualifyLeadFn } from '@/lib/inngest/qualifier'
import { pushOverdueTasksFn, pushWhatsappMessageFn } from '@/lib/inngest/push'
import { automationStaleLeadsFn, automationTaskOverdueFn } from '@/lib/inngest/automation-crons'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    sendEmail,
    processAutomationEvent,
    executeAutomationRun,
    importLeadsCsv,
    qualifyLeadFn,
    pushOverdueTasksFn,
    pushWhatsappMessageFn,
    automationStaleLeadsFn,
    automationTaskOverdueFn,
  ]
})
