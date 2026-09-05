import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { sendEmail, importLeadsCsv } from '@/lib/inngest/functions'
import { processAutomationEvent, processAutomationEventVerticals, processAutomationEventVerticals2, executeAutomationRun } from '@/lib/inngest/automation'
import { qualifyLeadFn } from '@/lib/inngest/qualifier'
import { pushOverdueTasksFn, pushWhatsappMessageFn, pushInstagramMessageFn, pushInstagramCommentFn } from '@/lib/inngest/push'
import { automationStaleLeadsFn, automationTaskOverdueFn, automationCustomerBirthdayFn } from '@/lib/inngest/automation-crons'
import { trialWarningEmailFn, trialExpiredEmailFn } from '@/lib/inngest/trial-emails'
import { integrationHealthPruneFn } from '@/lib/inngest/health-cron'
import { generateSystemAlertsFn } from '@/lib/inngest/alerts-cron'
import { scheduledWhatsappMessageFn, scheduledMessagesReconcileFn } from '@/lib/inngest/scheduled-messages-cron'
import { proposalEventFn } from '@/lib/inngest/proposal-events'
import { marketingSyncCronFn } from '@/lib/inngest/marketing-sync-cron'
import { sendCampaignFn } from '@/lib/inngest/send-campaigns-cron'
import { processInstagramInboundFn } from '@/lib/inngest/social-inbound'
import { processWhatsappInboundFn } from '@/lib/inngest/whatsapp-inbound'
import { ingestWhatsappMessageFn } from '@/lib/inngest/whatsapp-ingest'
import { backupDatabaseCronFn, backupStorageCronFn, backupRetentionCronFn } from '@/lib/inngest/backup-cron'
import { clinicAppointmentReminderCronFn } from '@/lib/inngest/clinic-crons'
import { imoveisPipelineAdvanceFn } from '@/lib/inngest/imoveis-pipeline-advance'
import { insuranceRenewalReminderCronFn } from '@/lib/inngest/insurance-crons'
import { dailyOwnerDigestFn } from '@/lib/inngest/daily-digest-cron'

// Sem isso, a function serverless usa o teto padrão do plano da Vercel
// (bem menor que isso) — o backup de storage varre 12 buckets legados
// recursivamente + baixa/reenvia cada objeto novo, o que pode passar
// fácil do teto padrão numa carga maior. 300s é o máximo do plano Pro
// sem Fluid Compute; reavaliar se o volume de storage crescer muito
// (ver "Como escalar" em docs/backup-disaster-recovery.md).
export const maxDuration = 300

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    sendEmail,
    processAutomationEvent,
    processAutomationEventVerticals,
    processAutomationEventVerticals2,
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
    integrationHealthPruneFn,
    generateSystemAlertsFn,
    scheduledWhatsappMessageFn,
    scheduledMessagesReconcileFn,
    proposalEventFn,
    marketingSyncCronFn,
    sendCampaignFn,
    processInstagramInboundFn,
    processWhatsappInboundFn,
    ingestWhatsappMessageFn,
    backupDatabaseCronFn,
    backupStorageCronFn,
    backupRetentionCronFn,
    clinicAppointmentReminderCronFn,
    imoveisPipelineAdvanceFn,
    insuranceRenewalReminderCronFn,
    dailyOwnerDigestFn,
  ]
})
