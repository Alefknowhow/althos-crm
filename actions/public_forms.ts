'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { buildFormSchema } from '@/lib/validators/form'
import { runAntispamGauntlet } from '@/lib/security/antispam'

import { inngest } from '@/lib/inngest/client'

export async function submitPublicForm(slug: string, rawData: any, utms: any, meta: any) {
  // Anti-spam gauntlet (honeypot + min fill time + Turnstile + IP rate limit).
  // Generic error so we don't leak which defense caught the bot.
  const guard = await runAntispamGauntlet(
    `public_form:${slug}`,
    {
      honeypotValue: meta?.honeypot ?? null,
      formMountedAt: meta?.formMountedAt ?? null,
      turnstileToken: meta?.turnstileToken ?? null,
    },
    { maxPerWindow: 10, windowMinutes: 60 },
  )
  if (!guard.ok) {
    console.warn(`[antispam] blocked submitPublicForm slug=${slug} reason=${guard.reason}`)
    return { ok: false, error: 'Erro ao enviar formulário. Tente novamente em alguns minutos.' }
  }

  const supabaseAdmin = createAdminClient()

  const { data: form } = await supabaseAdmin.from('forms').select('*').eq('slug', slug).maybeSingle()
  if (!form || !form.is_active) {
    return { ok: false, error: 'Formulário inativo ou não encontrado' }
  }

  const schema = buildFormSchema(form.schema)
  const validation = schema.safeParse(rawData)
  if (!validation.success) {
    return { ok: false, error: 'Dados inválidos', errors: validation.error.flatten().fieldErrors }
  }

  const validData = validation.data

  const emailFieldId = form.schema.fields.find((f: any) => f.type === 'email')?.id
  const emailValue = emailFieldId ? validData[emailFieldId] : null
  const nameFieldId = form.schema.fields.find((f: any) => f.type === 'short_text' && f.label.toLowerCase().includes('nome'))?.id
  const nameValue = nameFieldId ? validData[nameFieldId] : 'Lead via Formulário'
  const phoneFieldId = form.schema.fields.find((f: any) => f.type === 'phone')?.id
  const phoneValue = phoneFieldId ? validData[phoneFieldId] : null

  let leadId: string | null = null

  if (emailValue) {
    const { data: existingLead } = await supabaseAdmin.from('leads').select('id')
      .eq('organization_id', form.organization_id)
      .eq('email', emailValue).maybeSingle()

    if (existingLead) {
      leadId = existingLead.id
      await supabaseAdmin.from('leads').update({
        name: nameValue,
        phone: phoneValue || undefined,
        stage_id: form.stage_id || undefined,
        updated_at: new Date().toISOString()
      }).eq('id', leadId)
    }
  }

  if (!leadId) {
    const { data: newLead } = await supabaseAdmin.from('leads').insert({
      organization_id: form.organization_id,
      pipeline_id: form.pipeline_id,
      stage_id: form.stage_id,
      name: nameValue,
      email: emailValue || null,
      phone: phoneValue || null,
      source: `form:${form.name}`,
      utm: utms,
      custom_fields: validData
    }).select('id').single()
    if (newLead) leadId = newLead.id
  }

  // Save the submission. The utms object from the page uses keys "source/medium/campaign"
  // (short form), so we normalise here. Also save inside meta for fallback.
  const utmSource   = utms?.utm_source   || utms?.source   || null
  const utmMedium   = utms?.utm_medium   || utms?.medium   || null
  const utmCampaign = utms?.utm_campaign || utms?.campaign || null

  const { error: submissionError } = await supabaseAdmin.from('form_submissions').insert({
    form_id: form.id,
    lead_id: leadId,
    data: validData,
    meta: meta,
    utm_source: utmSource,
    utm_medium: utmMedium,
    utm_campaign: utmCampaign,
  })

  if (submissionError) {
    // Log the error so we can debug, but don't fail the submission — the lead
    // was already created and we don't want the user to re-submit.
    console.error('[submitPublicForm] form_submissions insert failed:', submissionError.message, {
      formId: form.id,
      slug,
    })
  }

  if (leadId) {
    // lead_activity — best-effort, don't fail the submission on error.
    const { error: activityError } = await supabaseAdmin.from('lead_activities').insert({
      lead_id: leadId,
      organization_id: form.organization_id,
      type: 'form_submitted',
      payload: { form_id: form.id, form_name: form.name, data: validData }
    })
    if (activityError) console.warn('[submitPublicForm] lead_activities insert failed:', activityError.message)

    // Inngest events are best-effort. If Inngest is not configured (dev without
    // the dev server, or missing INNGEST_EVENT_KEY in prod), we don't want to
    // break the public-facing form submission.
    try {
      await inngest.send({
        name: 'form.submitted',
        data: {
          orgId: form.organization_id,
          formId: form.id,
          leadId: leadId
        }
      })
    } catch (e: any) {
      console.warn('[submitPublicForm] inngest form.submitted failed:', e?.message)
    }

    try {
      await inngest.send({
        name: 'lead.qualify_requested',
        data: {
          orgId: form.organization_id,
          leadId,
          formId: form.id,
        },
      })
    } catch (e: any) {
      console.warn('[submitPublicForm] inngest lead.qualify_requested failed:', e?.message)
    }
  }

  // ── Meta CAPI — fire Lead event server-side ─────────────────────────────
  // Pull pixel config from the org (token is never sent to the browser).
  const { data: orgMeta } = await supabaseAdmin
    .from('organizations')
    .select('meta_pixel_id, meta_access_token')
    .eq('id', form.organization_id)
    .maybeSingle()

  const pixelId = orgMeta?.meta_pixel_id || null
  const accessToken = orgMeta?.meta_access_token || null

  if (pixelId && accessToken) {
    try {
      const { sendCapiEvent } = await import('@/lib/meta/capi')
      await sendCapiEvent({
        pixelId,
        accessToken,
        eventName: 'Lead',
        email: emailValue,
        phone: phoneValue,
        firstName: nameValue !== 'Lead via Formulário' ? nameValue : null,
        eventSourceUrl: meta?.url || undefined,
        userAgent: meta?.userAgent || undefined,
        // Use leadId as dedup key so client fbq + server CAPI don't double-count
        eventId: leadId || undefined,
      })
    } catch (e: any) {
      console.warn('[submitPublicForm] Meta CAPI Lead event failed:', e?.message)
    }
  }

  return {
    ok: true,
    thankYouMessage: form.schema.thankYouMessage || 'Enviado com sucesso!',
    // Return pixel_id so PublicFormClient can fire client-side fbq in sync
    metaPixelId: pixelId,
    leadEventId: leadId,
  }
}
