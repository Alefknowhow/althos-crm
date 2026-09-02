/**
 * Absorve o trabalho pesado que antes rodava DENTRO da requisição do
 * webhook (app/api/webhooks/whatsapp/route.ts): resolver/criar a conversa,
 * resolver/criar o lead (incl. atribuição de anúncio CTWA via Graph API),
 * baixar mídia e gravar a mensagem. O webhook agora só identifica a org e
 * enfileira este evento por mensagem — Meta recebe o 200 quase na hora, e
 * esse trabalho roda aqui, fora do ciclo de resposta rápido que a Meta
 * espera. Ao final, dispara os mesmos dois eventos que o webhook disparava
 * antes (push + Agente IA), preservando o comportamento existente.
 */

import { inngest } from './client'
import { createAdminClient } from '@/lib/supabase/server'
import { resolveAdCampaignExternalId } from '@/lib/meta/ads'
import { uploadSystemFile } from '@/lib/storage/system'

export type WhatsappRawMessageEvent = {
  orgId: string
  phoneNumberId: string
  msg: any
  contactName: string
}

const MEDIA_MESSAGE_TYPES = new Set(['image', 'audio', 'video', 'document', 'sticker'])

async function downloadAndStoreMedia(
  orgId: string,
  conversationId: string,
  mediaId: string,
  accessToken: string,
): Promise<{ url: string; objectId: string } | null> {
  try {
    const metaRes = await fetch(`https://graph.facebook.com/v26.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!metaRes.ok) {
      console.error(`[whatsapp ingest] media metadata fetch failed (${metaRes.status}):`, await metaRes.text().catch(() => ''))
      return null
    }
    const meta = await metaRes.json()
    if (!meta.url) {
      console.error('[whatsapp ingest] media metadata has no url:', JSON.stringify(meta))
      return null
    }

    const fileRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!fileRes.ok) {
      console.error(`[whatsapp ingest] media file fetch failed (${fileRes.status})`)
      return null
    }
    const bytes = Buffer.from(await fileRes.arrayBuffer())

    const mimeType: string = meta.mime_type || 'application/octet-stream'
    const ext = mimeType.split('/')[1]?.split(';')[0] || 'bin'

    const uploaded = await uploadSystemFile({
      organizationId: orgId,
      category: 'whatsapp',
      scopeId: conversationId,
      conversationId,
      filename: `${mediaId}.${ext}`,
      contentType: mimeType,
      body: bytes,
    })
    if (!uploaded.ok) {
      console.error('[whatsapp ingest] media upload failed:', uploaded.error)
      return null
    }
    return { url: uploaded.url, objectId: uploaded.objectId }
  } catch (e: any) {
    console.error('[whatsapp ingest] media download failed:', e?.message)
    return null
  }
}

export const ingestWhatsappMessageFn = inngest.createFunction(
  {
    id:      'ingest-whatsapp-message',
    name:    'WhatsApp: processa mensagem recebida (fora do ciclo do webhook)',
    retries: 2,
    triggers: [{ event: 'whatsapp/message.raw' }],
  },
  async ({ event, step }: { event: { data: WhatsappRawMessageEvent }; step: any }) => {
    const { orgId, msg, contactName } = event.data
    const admin = createAdminClient()

    // Idempotência: o webhook pode reentregar a mesma mensagem (retry da
    // Meta) — checa antes de fazer qualquer outra coisa.
    const already = await step.run('check-idempotency', async () => {
      const { data } = await admin
        .from('whatsapp_messages')
        .select('id')
        .eq('meta_message_id', msg.id)
        .maybeSingle()
      return !!data
    })
    if (already) return { skipped: 'duplicate' }

    const org = await step.run('fetch-org', async () => {
      const { data } = await admin
        .from('organizations')
        .select('id, whatsapp_access_token, meta_access_token')
        .eq('id', orgId)
        .maybeSingle()
      return data
    })
    if (!org) return { skipped: 'org-not-found' }

    const phone: string = msg.from

    // Resolve/cria a conversa e o lead — inclui a atribuição de anúncio
    // CTWA (ctwa_clid + resolução do ad_id pro campaign_id local via Graph
    // API), preservando o comportamento original do webhook.
    const { conv, leadId } = await step.run('resolve-conversation-and-lead', async () => {
      let { data: conv } = await admin.from('whatsapp_conversations').select('*').eq('organization_id', orgId).eq('contact_phone', phone).single()

      let leadId = conv?.contato_id

      if (!leadId) {
        const { data: leads } = await admin.from('contatos').select('id').eq('organization_id', orgId).eq('phone', phone).limit(1)
        if (leads && leads.length > 0) leadId = leads[0].id
      }

      if (!leadId) {
        const { data: defaultPipeline } = await admin.from('pipelines').select('id').eq('organization_id', orgId).eq('is_default', true).single()
        let stageId = null
        if (defaultPipeline) {
          const { data: stage } = await admin.from('pipeline_stages').select('id').eq('pipeline_id', defaultPipeline.id).order('position').limit(1).single()
          stageId = stage?.id
        }

        const referral = msg.referral
        const ctwaClid: string | null = referral?.ctwa_clid || null
        const adId: string | null = referral?.source_id || null

        let resolvedCampaignId: string | null = null
        if (adId && org.meta_access_token) {
          const campaignExternalId = await resolveAdCampaignExternalId(adId, org.meta_access_token)
          if (campaignExternalId) {
            const { data: matchedCampaign } = await admin
              .from('campaigns')
              .select('id')
              .eq('organization_id', orgId)
              .eq('external_id', campaignExternalId)
              .maybeSingle()
            resolvedCampaignId = matchedCampaign?.id || null
          }
        }

        const { data: newLead } = await admin.from('contatos').insert({
          organization_id: orgId,
          name: contactName,
          phone: phone,
          source: 'whatsapp',
          pipeline_id: defaultPipeline?.id,
          stage_id: stageId,
          meta_ctwa_clid: ctwaClid,
          meta_ad_id: adId,
          meta_resolved_campaign_id: resolvedCampaignId,
        }).select('id').single()
        if (newLead) leadId = newLead.id
      }

      const preview: string = msg.text?.body || ({
        image: '📷 Foto', audio: '🎤 Áudio', video: '🎬 Vídeo',
        document: '📄 Documento', sticker: 'Figurinha', location: '📍 Localização',
      } as Record<string, string>)[msg.type] || '[Mídia]'

      if (!conv) {
        const { data: newConv } = await admin.from('whatsapp_conversations').insert({
          organization_id: orgId,
          contact_phone: phone,
          contact_name: contactName,
          contato_id: leadId,
          last_message_at: new Date(msg.timestamp * 1000).toISOString(),
          last_inbound_at: new Date(msg.timestamp * 1000).toISOString(),
          last_message_preview: preview,
          last_message_direction: 'inbound',
          unread_count: 1
        }).select().single()
        conv = newConv
      } else {
        await admin.from('whatsapp_conversations').update({
          last_message_at: new Date(msg.timestamp * 1000).toISOString(),
          last_inbound_at: new Date(msg.timestamp * 1000).toISOString(),
          last_message_preview: preview,
          last_message_direction: 'inbound',
          unread_count: (conv.unread_count || 0) + 1,
          contato_id: leadId
        }).eq('id', conv.id)
      }

      return { conv, leadId }
    })
    if (!conv) return { skipped: 'conversation-resolution-failed' }

    // Mídia: baixa e sobe pro Storage antes de gravar a mensagem — isolado
    // num step próprio pra poder falhar/retriar sem repetir a resolução de
    // conversa/lead acima.
    let messageContent: any = msg
    if (MEDIA_MESSAGE_TYPES.has(msg.type) && msg[msg.type]?.id && org.whatsapp_access_token) {
      const media = await step.run('download-media', () =>
        downloadAndStoreMedia(orgId, conv.id, msg[msg.type].id, org.whatsapp_access_token),
      )
      if (media) messageContent = { ...msg, media_url: media.url, media_object_id: media.objectId }
    }

    const insertedMsg = await step.run('insert-message', async () => {
      const { data } = await admin.from('whatsapp_messages').insert({
        conversation_id: conv.id,
        organization_id: orgId,
        direction: 'inbound',
        type: msg.type,
        content: messageContent,
        meta_message_id: msg.id,
        status: 'delivered'
      }).select('id').single()

      if (leadId) {
        await admin.from('contato_activities').insert({
          contato_id: leadId,
          organization_id: orgId,
          type: 'whatsapp_received',
          payload: { body: msg.text?.body || '[Mídia]', message_id: msg.id }
        })
      }

      return data
    })

    // Dispara os mesmos dois eventos que o webhook disparava antes —
    // push (throttled a 1/org/2min) e Agente IA (só quando há texto E a
    // conversa não está pausada). `conv.automation_paused` já foi buscado
    // acima (select('*')) — checar aqui evita acordar processWhatsappInboundFn
    // à toa: sem isso, toda conversa com IA desligada manualmente ainda
    // pagava uma execução extra só pra descobrir isso lá dentro.
    const events: { name: string; data: any }[] = [
      {
        name: 'whatsapp/message.received',
        data: { orgId, conversationId: conv.id, contactName, messageBody: msg.text?.body || null },
      },
    ]
    if (insertedMsg && msg.text?.body && !conv.automation_paused) {
      events.push({
        name: 'whatsapp/inbound.received',
        data: { orgId, conversationId: conv.id, metaMessageId: msg.id },
      })
    }
    await step.run('notify-and-ai', () => inngest.send(events))

    return { ok: true }
  },
)
