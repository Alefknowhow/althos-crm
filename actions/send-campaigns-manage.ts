'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'
import { inngest } from '@/lib/inngest/client'

/**
 * Leitura/gestão de campanhas já criadas (listar, ver detalhe, cancelar,
 * reenviar destinatário com falha, apagar rascunho) — separado de
 * actions/send-campaigns.ts (criação/materialização/agendamento), que
 * passou do limite de 350 linhas do lint. Mesma lógica, arquivo próprio.
 */

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

  // Campanha pode já estar 'completed' — reativa o processamento pra esse
  // item reenviado (a function trata status != canceled/draft como válido).
  const { data: recipient } = await supabase.from('send_campaign_recipients').select('campaign_id').eq('id', recipientId).maybeSingle()
  if (recipient) {
    await inngest.send({ name: 'campaign/send.requested', data: { campaignId: recipient.campaign_id } })
  }

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
