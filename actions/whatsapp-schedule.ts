'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'
import { inngest } from '@/lib/inngest/client'

/* ──────────────────────────────────────────────────────────────────────────
 * AGENDAMENTO DE MENSAGENS
 * Permite compor uma mensagem agora e entregá-la depois. Um cron Inngest
 * (a cada minuto) recolhe as pendentes e dispara via lib/whatsapp/
 * scheduled-delivery, com fallback de template fora da janela de 24h.
 * ──────────────────────────────────────────────────────────────────────── */

export type ScheduledMessage = {
  id:                   string
  conversation_id:      string
  body:                 string
  send_at:              string
  status:               'pending' | 'sending' | 'sent' | 'failed' | 'canceled'
  fallback_template_id: string | null
  fallback_variables:   string[]
  sent_via:             string | null
  error:                string | null
  created_at:           string
}

export async function scheduleWhatsappMessage(
  orgSlug: string,
  conversationId: string,
  content: string,
  sendAtISO: string,
  fallbackTemplateId?: string | null,
  fallbackVariables?: string[],
) {
  const user = await requireAuth()
  const org  = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const body = content.trim()
  if (!body) return { ok: false as const, error: 'Mensagem vazia.' }

  const when = new Date(sendAtISO)
  if (isNaN(when.getTime())) return { ok: false as const, error: 'Data inválida.' }
  // Pelo menos 1 minuto no futuro (o cron roda por minuto).
  if (when.getTime() < Date.now() + 30_000) {
    return { ok: false as const, error: 'Escolha um horário no futuro.' }
  }

  const { data: conv } = await supabase
    .from('whatsapp_conversations')
    .select('id, contato_id, contact_phone')
    .eq('id', conversationId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!conv) return { ok: false as const, error: 'Conversa não encontrada.' }

  const { data: row, error } = await supabase
    .from('scheduled_whatsapp_messages')
    .insert({
      organization_id:      org.id,
      conversation_id:      conv.id,
      contato_id:           conv.contato_id,
      contact_phone:        conv.contact_phone,
      body,
      send_at:              when.toISOString(),
      fallback_template_id: fallbackTemplateId || null,
      fallback_variables:   fallbackVariables || [],
      created_by:           user.id,
    })
    .select()
    .single()

  if (error) return { ok: false as const, error: error.message }

  // Acorda exatamente no horário de envio (step.sleepUntil) em vez de
  // depender de uma cron rodando o dia inteiro — ver lib/inngest/scheduled-messages-cron.ts.
  await inngest.send({
    name: 'whatsapp/message.scheduled',
    data: { scheduledId: row.id, sendAt: row.send_at },
  })

  revalidatePath(`/app/${orgSlug}/conversas`)
  return { ok: true as const, scheduled: row as ScheduledMessage }
}

export async function listScheduledMessages(orgSlug: string, conversationId: string) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data } = await supabase
    .from('scheduled_whatsapp_messages')
    .select('id, conversation_id, body, send_at, status, fallback_template_id, fallback_variables, sent_via, error, created_at')
    .eq('organization_id', org.id)
    .eq('conversation_id', conversationId)
    .eq('status', 'pending')
    .order('send_at', { ascending: true })

  return (data || []) as ScheduledMessage[]
}

export async function cancelScheduledMessage(orgSlug: string, scheduledId: string) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  // Só cancela enquanto ainda está pendente (não disputa com o cron já enviando).
  const { error } = await supabase
    .from('scheduled_whatsapp_messages')
    .update({ status: 'canceled' })
    .eq('id', scheduledId)
    .eq('organization_id', org.id)
    .eq('status', 'pending')

  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/conversas`)
  return { ok: true as const }
}

