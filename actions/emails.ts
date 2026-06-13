'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'
import { inngest } from '@/lib/inngest/client'
import { resend, clientEmailFrom } from '@/lib/resend'
import { renderTemplate } from '@/lib/inngest/functions'
import { getTemplateSeed } from '@/lib/email/template-seeds'

/**
 * Creates a new template in the user's org from one of the pre-built seeds.
 * The seed_key is stored so we can offer "atualizar com versão nova" later.
 */
export async function createTemplateFromSeed(orgSlug: string, seedKey: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const seed = getTemplateSeed(seedKey)
  if (!seed) return { ok: false as const, error: 'Template não encontrado' }

  const { data, error } = await supabase
    .from('email_templates')
    .insert({
      organization_id: org.id,
      name: seed.name,
      subject: seed.subject,
      body_html: seed.body_html,
      category: seed.category,
      seed_key: seed.key,
    })
    .select('id')
    .maybeSingle()

  if (error || !data) {
    return { ok: false as const, error: error?.message || 'Erro ao criar template' }
  }
  revalidatePath(`/app/${orgSlug}/email-templates`)
  return { ok: true as const, templateId: data.id }
}

export async function createTemplate(orgSlug: string, name: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  
  const { data: template, error } = await supabase.from('email_templates').insert({
    organization_id: org.id,
    name,
    subject: 'Olá {{lead.name}}',
    body_html: '<p>Olá {{lead.name}},</p><br><p>Escreva sua mensagem aqui.</p>'
  }).select().single()

  if (error) return { ok: false, error: error.message }
  revalidatePath(`/app/${orgSlug}/email-templates`)
  return { ok: true, template }
}

export async function updateTemplate(orgSlug: string, id: string, updates: any) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  
  const { error } = await supabase.from('email_templates').update(updates).eq('id', id).eq('organization_id', org.id)
  
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/app/${orgSlug}/email-templates`)
  revalidatePath(`/app/${orgSlug}/email-templates/${id}/edit`)
  return { ok: true }
}

export async function sendTestEmail(orgSlug: string, templateId: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  
  const { data: template } = await supabase.from('email_templates').select('*').eq('id', templateId).maybeSingle()
  if (!template) return { ok: false, error: 'Template não encontrado' }

  const variables = {
    lead: { name: 'João Silva', email: user.email, phone: '(11) 99999-9999' },
    org: { name: org.name },
    custom: { empresa: 'Acme Corp' }
  }

  const subject = renderTemplate(template.subject || '', variables)
  const htmlBody = renderTemplate(template.body_html || '', variables)

  // Supabase auth user.email is `string | undefined`, but resend's `to` accepts
  // only `string | string[]`. Bail out if the test user has no email.
  if (!user.email) return { ok: false, error: 'Usuário sem e-mail cadastrado.' }

  try {
    const { error } = await resend.emails.send({
      from: clientEmailFrom(org.name),
      to: user.email,
      subject: `[TESTE] ${subject}`,
      html: htmlBody
    })
    if (error) throw error
    return { ok: true }
  } catch(e:any) {
    return { ok: false, error: e.message }
  }
}

export async function queueEmailForLead(orgSlug: string, leadId: string, templateId: string, toEmail: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  
  const { data: emailSend, error } = await supabase.from('email_sends').insert({
    organization_id: org.id,
    contato_id: leadId,
    template_id: templateId,
    to_email: toEmail,
    status: 'queued'
  }).select().single()
  
  if (error) return { ok: false, error: error.message }

  await inngest.send({ name: 'email.send', data: { emailSendId: emailSend.id } })

  revalidatePath(`/app/${orgSlug}/contatos/${leadId}`)
  return { ok: true }
}
