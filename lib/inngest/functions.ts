import { inngest } from './client'
import { createAdminClient } from '../supabase/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export function renderTemplate(templateStr: string, variables: any) {
  if (!templateStr) return ''
  return templateStr.replace(/\{\{(.*?)\}\}/g, (match, path) => {
    const keys = path.trim().split('.')
    let val = variables
    for (const key of keys) {
      if (val === undefined || val === null) return ''
      val = val[key]
    }
    return val !== undefined && val !== null ? String(val) : ''
  })
}

export const sendEmail = inngest.createFunction(
  {
    id: 'send-email',
    triggers: [{ event: 'email.send' }],
  },
  async ({ event, step }) => {
    const { emailSendId } = event.data
    const supabase = createAdminClient()

    const { data: emailSend } = await supabase
      .from('email_sends')
      .select('*, leads(*, organizations(*)), email_templates(*)')
      .eq('id', emailSendId)
      .maybeSingle()

    if (!emailSend) throw new Error('Email send not found')

    const { leads: lead, email_templates: template } = emailSend
    if (!lead || !template) throw new Error('Missing lead or template')

    const variables = {
      lead: { name: lead.name, email: lead.email, phone: lead.phone },
      org: { name: lead.organizations?.name },
      custom: lead.custom_fields || {},
    }

    const subject = renderTemplate(template.subject || '', variables)
    const htmlBody = renderTemplate(template.body_html || '', variables)
    const fromEmail =
      lead.organizations?.email_from_address || 'onboarding@resend.dev'

    try {
      const { data: resendResponse, error } = await resend.emails.send({
        from: `Althos CRM <${fromEmail}>`,
        to: emailSend.to_email,
        subject,
        html: htmlBody,
      })

      if (error) throw error

      await supabase
        .from('email_sends')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          resend_id: resendResponse?.id,
        })
        .eq('id', emailSendId)

      await supabase.from('lead_activities').insert({
        lead_id: lead.id,
        organization_id: lead.organization_id,
        type: 'email_sent',
        payload: {
          email_send_id: emailSendId,
          subject,
          template_name: template.name,
        },
      })

      return { resendId: resendResponse?.id }
    } catch (err: any) {
      await supabase
        .from('email_sends')
        .update({
          status: 'failed',
        })
        .eq('id', emailSendId)
      throw err
    }
  }
)


export const importLeadsCsv = inngest.createFunction(
  { 
    id: 'import-leads-csv',
    triggers: [{ event: 'leads.import_csv' }]
  },
  async ({ event, step }) => {
    const { orgId, userId, rows, mapping } = event.data
    const supabase = createAdminClient()

    let successCount = 0
    let errorCount = 0

    // 1. Fetch default pipeline/stage if not in mapping
    const { data: defaultPipeline } = await supabase
      .from('pipelines')
      .select('id')
      .eq('organization_id', orgId)
      .eq('is_default', true)
      .maybeSingle()
    const { data: defaultStage } = defaultPipeline
      ? await supabase
          .from('pipeline_stages')
          .select('id, pipeline_id')
          .eq('pipeline_id', defaultPipeline.id)
          .order('position')
          .limit(1)
          .maybeSingle()
      : { data: null }

    for (const row of rows) {
      try {
        const leadData: any = {
          organization_id: orgId,
          name: row[mapping.name] || 'Lead Importado',
          email: row[mapping.email] || null,
          phone: row[mapping.phone] || null,
          source: 'csv_import',
          stage_id: defaultStage?.id,
          pipeline_id: defaultStage?.pipeline_id,
          assigned_to: userId
        }

        const { error } = await supabase.from('leads').insert(leadData)
        if (error) throw error
        successCount++
      } catch (err) {
        errorCount++
      }
    }

    // 2. Create notification
    await supabase.from('notifications').insert({
      organization_id: orgId,
      user_id: userId,
      type: 'import_completed',
      title: 'Importação concluída',
      content: `${successCount} leads importados com sucesso. ${errorCount} falhas.`,
      link: `/app` // or leads list
    })

    return { successCount, errorCount }
  }
)