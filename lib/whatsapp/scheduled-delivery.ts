/**
 * Delivery core for scheduled WhatsApp messages.
 *
 * Kept out of the `'use server'` actions file so the per-minute Inngest cron can
 * import it directly. Receives an admin Supabase client (RLS-bypassing) because
 * the cron runs without a user session.
 *
 * The 24h rule: the WhatsApp Business API only allows free-form text within 24h
 * of the customer's last inbound message. Outside that window we must use an
 * approved template — so a scheduled row may carry an optional fallback template.
 */

import { sendTextMessage, sendTemplateMessage } from './meta-client'

const WINDOW_MS = 24 * 60 * 60 * 1000

export type ScheduledRow = {
  id: string
  organization_id: string
  conversation_id: string
  contato_id: string | null
  contact_phone: string
  body: string
  fallback_template_id: string | null
  fallback_variables: string[] | null
}

/** Render a template body for the inbox preview by substituting {{1}}, {{2}}… */
function renderTemplateBody(bodyText: string, variables: string[]): string {
  let out = bodyText || ''
  variables.forEach((v, i) => {
    out = out.replaceAll(`{{${i + 1}}}`, v)
  })
  return out
}

/**
 * Deliver one scheduled row. Returns the outcome; the caller (cron) has already
 * claimed the row by flipping its status to 'sending'. This function writes the
 * final status ('sent' | 'failed') itself.
 */
export async function deliverScheduledMessage(
  admin: any,
  row: ScheduledRow,
): Promise<{ ok: boolean; via?: 'text' | 'template'; error?: string }> {
  // 1. Org WhatsApp credentials.
  const { data: org } = await admin
    .from('organizations')
    .select('id, whatsapp_phone_number_id, whatsapp_access_token')
    .eq('id', row.organization_id)
    .maybeSingle()

  if (!org) {
    await markFailed(admin, row.id, 'Organização não encontrada')
    return { ok: false, error: 'Organização não encontrada' }
  }

  // 2. Is the 24h customer-service window still open? (last inbound message)
  const { data: lastInbound } = await admin
    .from('whatsapp_messages')
    .select('created_at')
    .eq('conversation_id', row.conversation_id)
    .eq('direction', 'inbound')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const withinWindow =
    !!lastInbound?.created_at &&
    Date.now() - new Date(lastInbound.created_at).getTime() < WINDOW_MS

  // 3. Decide channel.
  const variables = row.fallback_variables || []
  let via: 'text' | 'template'
  let previewBody = row.body
  let template: any = null

  if (withinWindow) {
    via = 'text'
  } else if (row.fallback_template_id) {
    const { data: tpl } = await admin
      .from('whatsapp_templates')
      .select('*')
      .eq('id', row.fallback_template_id)
      .maybeSingle()
    if (!tpl) {
      await markFailed(admin, row.id, 'Template de fallback não encontrado')
      return { ok: false, error: 'Template de fallback não encontrado' }
    }
    template = tpl
    via = 'template'
    previewBody = renderTemplateBody(tpl.body_text, variables)
  } else {
    const reason =
      'Fora da janela de 24h e sem template de fallback configurado'
    await markFailed(admin, row.id, reason)
    return { ok: false, error: reason }
  }

  // 4. Record the outbound message (so the inbox shows it immediately).
  const { data: msg } = await admin
    .from('whatsapp_messages')
    .insert({
      conversation_id: row.conversation_id,
      organization_id: row.organization_id,
      direction: 'outbound',
      type: via === 'template' ? 'template' : 'text',
      content: { body: previewBody },
      status: 'sending',
    })
    .select()
    .single()

  // 5. Send via Meta.
  try {
    let metaRes: any
    if (via === 'text') {
      metaRes = await sendTextMessage(org, row.contact_phone, row.body)
    } else {
      metaRes = await sendTemplateMessage(
        org,
        row.contact_phone,
        template.name,
        variables,
        template.language || 'pt_BR',
        template.header_type,
        template.header_media_url || undefined,
      )
    }

    const metaId = metaRes?.messages?.[0]?.id ?? null

    if (msg) {
      await admin
        .from('whatsapp_messages')
        .update({ meta_message_id: metaId, status: 'sent' })
        .eq('id', msg.id)
    }

    // Bump the inbox preview/order.
    await admin
      .from('whatsapp_conversations')
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: previewBody,
        last_message_direction: 'outbound',
      })
      .eq('id', row.conversation_id)

    // Activity trail on the contact.
    if (row.contato_id) {
      await admin.from('contato_activities').insert({
        contato_id: row.contato_id,
        organization_id: row.organization_id,
        type: 'whatsapp_sent',
        payload: { body: previewBody, scheduled: true, via },
      })
    }

    await admin
      .from('scheduled_whatsapp_messages')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        sent_via: via,
        meta_message_id: metaId,
        error: null,
      })
      .eq('id', row.id)

    return { ok: true, via }
  } catch (e: any) {
    if (msg) {
      await admin
        .from('whatsapp_messages')
        .update({
          status: 'failed',
          content: { body: previewBody, error: e.message },
        })
        .eq('id', msg.id)
    }
    await markFailed(admin, row.id, e.message || 'Erro ao enviar')
    return { ok: false, error: e.message }
  }
}

async function markFailed(admin: any, id: string, error: string) {
  await admin
    .from('scheduled_whatsapp_messages')
    .update({ status: 'failed', error })
    .eq('id', id)
}
