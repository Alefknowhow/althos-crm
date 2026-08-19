import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { sendEmail, importLeadsCsv } from '@/lib/inngest/functions'
import { processAutomationEvent, executeAutomationRun } from '@/lib/inngest/automation'
import { qualifyLeadFn } from '@/lib/inngest/qualifier'
import { pushOverdueTasksFn, pushWhatsappMessageFn, pushInstagramMessageFn, pushInstagramCommentFn } from '@/lib/inngest/push'
import { automationStaleLeadsFn, automationTaskOverdueFn, automationCustomerBirthdayFn } from '@/lib/inngest/automation-crons'
import { trialWarningEmailFn, trialExpiredEmailFn } from '@/lib/inngest/trial-emails'
import { integrationHealthCheckFn, integrationHealthPruneFn } from '@/lib/inngest/health-cron'
import { generateSystemAlertsFn } from '@/lib/inngest/alerts-cron'
import { scheduledWhatsappMessagesFn } from '@/lib/inngest/scheduled-messages-cron'
import { proposalEventFn } from '@/lib/inngest/proposal-events'
import { dashboardInsightsCronFn } from '@/lib/inngest/dashboard-insights-cron'
import { marketingSyncCronFn } from '@/lib/inngest/marketing-sync-cron'
import { sendCampaignsCronFn } from '@/lib/inngest/send-campaigns-cron'
import { processInstagramInboundFn } from '@/lib/inngest/social-inbound'
import { processWhatsappInboundFn } from '@/lib/inngest/whatsapp-inbound'
import { backupDatabaseCronFn, backupStorageCronFn, backupRetentionCronFn } from '@/lib/inngest/backup-cron'

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
    pushInstagramMessageFn,
    pushInstagramCommentFn,
    automationStaleLeadsFn,
    automationTaskOverdueFn,
    automationCustomerBirthdayFn,
    trialWarningEmailFn,
    trialExpiredEmailFn,
    integrationHealthCheckFn,
    integrationHealthPruneFn,
    generateSystemAlertsFn,
    scheduledWhatsappMessagesFn,
    proposalEventFn,
    dashboardInsightsCronFn,
    marketingSyncCronFn,
    sendCampaignsCronFn,
    processInstagramInboundFn,
    processWhatsappInboundFn,
    backupDatabaseCronFn,
    backupStorageCronFn,
    backupRetentionCronFn,
  ]
})
