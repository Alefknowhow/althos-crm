'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'
import { checkFeatureAccessByOrgSlug } from '@/lib/plans/server'

const UPGRADE_ERROR = 'Campanhas de Envio não estão incluídas no seu plano atual. Faça upgrade para o Pro ou Business para usar este recurso.'

export interface AudienceFilter {
  tags: string[]
  stageIds: string[]
  pipelineId: string | null
}

async function buildAudienceQuery(supabase: ReturnType<typeof createClient>, orgId: string, filter: AudienceFilter) {
  let q = supabase
    .from('contatos')
    .select('id, name, phone, email', { count: 'exact' })
    .eq('organization_id', orgId)

  if (filter.tags.length > 0) q = q.overlaps('tags', filter.tags)
  if (filter.stageIds.length > 0) q = q.in('stage_id', filter.stageIds)
  if (filter.pipelineId) q = q.eq('pipeline_id', filter.pipelineId)

  return q
}

export async function previewAudienceCount(orgSlug: string, filter: AudienceFilter) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const q = await buildAudienceQuery(supabase, org.id, filter)
  const { count } = await q
  return count || 0
}

export interface CreateCampaignInput {
  name: string
  channel: 'whatsapp' | 'email'
  waTemplateId?: string | null
  emailTemplateId?: string | null
  audience: AudienceFilter
}

export async function createCampaignDraft(orgSlug: string, input: CreateCampaignInput) {
  if (!(await checkFeatureAccessByOrgSlug(orgSlug, 'bulk_campaigns'))) {
    return { ok: false as const, error: UPGRADE_ERROR }
  }
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const name = input.name.trim()
  if (!name) return { ok: false as const, error: 'Dê um nome à campanha.' }

  let waFields: Record<string, any> = {}
  if (input.channel === 'whatsapp') {
    if (!input.waTemplateId) return { ok: false as const, error: 'Selecione um template aprovado.' }
    const { data: tpl } = await supabase
      .from('whatsapp_templates')
      .select('id, name, language, header_type, header_media_url, status')
      .eq('id', input.waTemplateId)
      .eq('organization_id', org.id)
      .maybeSingle()
    if (!tpl || tpl.status !== 'approved') {
      return { ok: false as const, error: 'O template selecionado não está aprovado pela Meta.' }
    }
    waFields = {
      wa_template_id: tpl.id,
      wa_template_name: tpl.name,
      wa_template_language: tpl.language,
      wa_header_type: tpl.header_type,
      wa_header_media_url: tpl.header_media_url,
    }
  } else {
    if (!input.emailTemplateId) return { ok: false as const, error: 'Selecione um template de e-mail.' }
    const { data: tpl } = await supabase
      .from('email_templates')
      .select('id')
      .eq('id', input.emailTemplateId)
      .eq('organization_id', org.id)
      .maybeSingle()
    if (!tpl) return { ok: false as const, error: 'Template de e-mail não encontrado.' }
  }

  const { data: row, error } = await supabase
    .from('send_campaigns')
    .insert({
      organization_id: org.id,
      name,
      channel: input.channel,
      ...waFields,
      email_template_id: input.channel === 'email' ? input.emailTemplateId : null,
      audience_tags: input.audience.tags,
      audience_stage_ids: input.audience.stageIds,
      audience_pipeline_id: input.audience.pipelineId,
      status: 'draft',
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/campanhas`)
  return { ok: true as const, campaignId: row.id }
}

export async function materializeAndScheduleCampaign(orgSlug: string, campaignId: string, sendAtISO?: string | null) {
  if (!(await checkFeatureAccessByOrgSlug(orgSlug, 'bulk_campaigns'))) {
    return { ok: false as const, error: UPGRADE_ERROR }
  }
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data: campaign } = await supabase
    .from('send_campaigns')
    .select('*')
    .eq('id', campaignId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!campaign) return { ok: false as const, error: 'Campanha não encontrada.' }
  if (campaign.status !== 'draft') return { ok: false as const, error: 'Essa campanha já foi confirmada.' }

  let scheduledAt: string | null = null
  if (sendAtISO) {
    const when = new Date(sendAtISO)
    if (isNaN(when.getTime())) return { ok: false as const, error: 'Data inválida.' }
    scheduledAt = when.toISOString()
  }

  const filter: AudienceFilter = {
    tags: campaign.audience_tags || [],
    stageIds: campaign.audience_stage_ids || [],
    pipelineId: campaign.audience_pipeline_id,
  }
  const q = await buildAudienceQuery(supabase, org.id, filter)
  const { data: contacts, error: audienceError } = await q
  if (audienceError) return { ok: false as const, error: audienceError.message }
  if (!contacts || contacts.length === 0) {
    return { ok: false as const, error: 'Nenhum contato entrou nesse filtro.' }
  }

  const recipients = contacts.map(c => {
    const hasChannel = campaign.channel === 'whatsapp' ? !!c.phone : !!c.email
    return {
      campaign_id: campaign.id,
      organization_id: org.id,
      contato_id: c.id,
      contact_name: c.name,
      contact_phone: c.phone,
      contact_email: c.email,
      status: hasChannel ? 'pending' : 'skipped',
    }
  })

  const BATCH = 500
  for (let i = 0; i < recipients.length; i += BATCH) {
    const { error } = await supabase.from('send_campaign_recipients').insert(recipients.slice(i, i + BATCH))
    if (error) return { ok: false as const, error: error.message }
  }

  const { error: updateError } = await supabase
    .from('send_campaigns')
    .update({
      status: 'scheduled',
      scheduled_at: scheduledAt,
      recipient_count: recipients.length,
    })
    .eq('id', campaign.id)

  if (updateError) return { ok: false as const, error: updateError.message }

  revalidatePath(`/app/${orgSlug}/campanhas`)
  revalidatePath(`/app/${orgSlug}/campanhas/${campaignId}`)
  return { ok: true as const }
}

export async function listCampaigns(orgSlug: string) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data } = await supabase
    .from('send_campaigns')
    .select('id, name, channel, status, recipient_count, sent_count, failed_count, scheduled_at, completed_at, created_at')
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })

  return data || []
}

export async function getCampaignDetail(orgSlug: string, campaignId: string) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data: campaign } = await supabase
    .from('send_campaigns')
    .select('*')
    .eq('id', campaignId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!campaign) return null

  const { data: recipients } = await supabase
    .from('send_campaign_recipients')
    .select('id, contato_id, contact_name, contact_phone, contact_email, status, sent_at, error')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true })

  return { campaign, recipients: recipients || [] }
}

export async function cancelCampaign(orgSlug: string, campaignId: string) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { error } = await supabase
    .from('send_campaigns')
    .update({ status: 'canceled' })
    .eq('id', campaignId)
    .eq('organization_id', org.id)
    .in('status', ['scheduled', 'sending'])

  if (error) return { ok: false as const, error: error.message }

  // Linhas ainda não processadas não devem mais ser pegas pelo cron.
  await supabase
    .from('send_campaign_recipients')
    .update({ status: 'skipped' })
    .eq('campaign_id', campaignId)
    .eq('status', 'pending')

  revalidatePath(`/app/${orgSlug}/campanhas`)
  revalidatePath(`/app/${orgSlug}/campanhas/${campaignId}`)
  return { ok: true as const }
}

export async function resendFailedRecipient(orgSlug: string, recipientId: string) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { error } = await supabase
    .from('send_campaign_recipients')
    .update({ status: 'pending', error: null })
    .eq('id', recipientId)
    .eq('organization_id', org.id)
    .eq('status', 'failed')

  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}

export async function deleteCampaignDraft(orgSlug: string, campaignId: string) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { error } = await supabase
    .from('send_campaigns')
    .delete()
    .eq('id', campaignId)
    .eq('organization_id', org.id)
    .eq('status', 'draft')

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/campanhas`)
  return { ok: true as const }
}
