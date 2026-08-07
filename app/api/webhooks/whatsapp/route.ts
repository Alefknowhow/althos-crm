import { NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/server'
import { inngest } from '@/lib/inngest/client'
import { resolveAdCampaignExternalId } from '@/lib/meta/ads'

/**
 * Webhook global do WhatsApp — UMA única URL por App da Meta (não dá pra
 * registrar uma URL por org: a Meta só aceita um callback por App).
 *
 * Cada organização conecta seu próprio número via Embedded Signup
 * (actions/whatsapp.ts::connectWhatsappEmbedded), que assina o App nos
 * webhooks da WABA do cliente e salva o phone_number_id em
 * organizations.whatsapp_phone_number_id. Toda mensagem recebida aqui vem
 * com esse mesmo phone_number_id no payload (change.value.metadata), então
 * é isso que usamos pra descobrir de qual organização é a mensagem —
 * a URL não carrega mais o orgId.
 */

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN
  if (!verifyToken) {
    console.error('[whatsapp webhook] META_WEBHOOK_VERIFY_TOKEN not set')
    return new NextResponse('Forbidden', { status: 403 })
  }

  if (mode === 'subscribe' && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

const MEDIA_MESSAGE_TYPES = new Set(['image', 'audio', 'video', 'document', 'sticker'])

/**
 * A mensagem de mídia do WhatsApp só traz um media_id — a URL real é
 * temporária (expira em minutos) e exige o token de acesso pra baixar.
 * Baixa o arquivo e sobe no bucket `whatsapp-media` pra ter uma URL
 * permanente que o CRM consegue exibir depois. Retorna null em qualquer
 * falha (a mensagem ainda é salva, só sem mídia — não trava o webhook).
 */
async function downloadAndStoreMedia(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  mediaId: string,
  accessToken: string,
): Promise<string | null> {
  try {
    const metaRes = await fetch(`https://graph.facebook.com/v19.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!metaRes.ok) {
      console.error(`[whatsapp webhook] media metadata fetch failed (${metaRes.status}):`, await metaRes.text().catch(() => ''))
      return null
    }
    const meta = await metaRes.json()
    if (!meta.url) {
      console.error('[whatsapp webhook] media metadata has no url:', JSON.stringify(meta))
      return null
    }

    const fileRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!fileRes.ok) {
      console.error(`[whatsapp webhook] media file fetch failed (${fileRes.status})`)
      return null
    }
    const bytes = await fileRes.arrayBuffer()

    const mimeType: string = meta.mime_type || 'application/octet-stream'
    const ext = mimeType.split('/')[1]?.split(';')[0] || 'bin'
    const path = `${orgId}/${mediaId}.${ext}`

    const { error } = await supabase.storage.from('whatsapp-media').upload(path, bytes, {
      contentType: mimeType,
      upsert: true,
    })
    if (error) {
      console.error('[whatsapp webhook] media upload failed:', error.message)
      return null
    }

    const { data: { publicUrl } } = supabase.storage.from('whatsapp-media').getPublicUrl(path)
    return publicUrl
  } catch (e: any) {
    console.error('[whatsapp webhook] media download failed:', e?.message)
    return null
  }
}

/** Verify Meta's X-Hub-Signature-256 header against the raw body. */
function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.META_APP_SECRET
  if (!appSecret) {
    console.warn('[whatsapp webhook] META_APP_SECRET not set — incoming payloads are NOT being verified')
    return true
  }
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false

  const expected = 'sha256=' + createHmac('sha256', appSecret).update(rawBody).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(signatureHeader)
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export async function POST(req: Request) {
  try {
    // We need the RAW body to validate the HMAC signature, then parse manually.
    const rawBody = await req.text()
    const signature = req.headers.get('x-hub-signature-256')

    if (!verifySignature(rawBody, signature)) {
      console.warn('[whatsapp webhook] invalid signature')
      return new NextResponse('Forbidden', { status: 403 })
    }

    const payload = JSON.parse(rawBody)
    const supabase = createAdminClient()

    if (payload.object !== 'whatsapp_business_account') {
      return NextResponse.json({ ok: true })
    }

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        const phoneNumberId: string | undefined = change.value?.metadata?.phone_number_id
        if (!phoneNumberId) continue

        // Resolve qual organização é dona desse número — cada org conecta o
        // seu via Embedded Signup, salvando o phone_number_id na tabela.
        const { data: org } = await supabase
          .from('organizations')
          .select('id, whatsapp_access_token, meta_access_token')
          .eq('whatsapp_phone_number_id', phoneNumberId)
          .maybeSingle()
        if (!org) {
          console.warn(`[whatsapp webhook] nenhuma org encontrada pro phone_number_id ${phoneNumberId}`)
          continue
        }
        const orgId = org.id

        if (change.value.messages) {
          for (const msg of change.value.messages) {
            const phone = msg.from
            const contactName = change.value.contacts?.[0]?.profile?.name || phone

            // Idempotency: drop duplicates by Meta's message id before doing any work.
            // Webhooks can be re-delivered, and without this the conversation
            // unread_count and lead_activities would double-count on retries.
            const { data: existing } = await supabase
              .from('whatsapp_messages')
              .select('id')
              .eq('meta_message_id', msg.id)
              .maybeSingle()
            if (existing) continue

            let { data: conv } = await supabase.from('whatsapp_conversations').select('*').eq('organization_id', orgId).eq('contact_phone', phone).single()

            let leadId = conv?.contato_id

            if (!leadId) {
              const { data: leads } = await supabase.from('contatos').select('id').eq('organization_id', orgId).eq('phone', phone).limit(1)
              if (leads && leads.length > 0) leadId = leads[0].id
            }

            if (!leadId) {
              const { data: defaultPipeline } = await supabase.from('pipelines').select('id').eq('organization_id', orgId).eq('is_default', true).single()
              let stageId = null
              if (defaultPipeline) {
                const { data: stage } = await supabase.from('pipeline_stages').select('id').eq('pipeline_id', defaultPipeline.id).order('position').limit(1).single()
                stageId = stage?.id
              }

              // Conversas iniciadas por anúncio de Click-to-WhatsApp trazem
              // um objeto `referral` só na primeira mensagem, com o
              // ctwa_clid — o click ID que permite atribuir a venda de
              // volta ao anúncio de origem no CAPI (ver actions/contatos.ts,
              // moveLeadToStage) — e o source_id (ad_id), que resolvemos
              // agora pro campaign_id local, fechando o elo de CAC/ROAS de
              // WhatsApp no painel de Marketing (actions/marketing.ts).
              const referral = msg.referral
              const ctwaClid: string | null = referral?.ctwa_clid || null
              const adId: string | null = referral?.source_id || null

              let resolvedCampaignId: string | null = null
              if (adId && org.meta_access_token) {
                const campaignExternalId = await resolveAdCampaignExternalId(adId, org.meta_access_token)
                if (campaignExternalId) {
                  const { data: matchedCampaign } = await supabase
                    .from('campaigns')
                    .select('id')
                    .eq('organization_id', orgId)
                    .eq('external_id', campaignExternalId)
                    .maybeSingle()
                  resolvedCampaignId = matchedCampaign?.id || null
                }
              }

              const { data: newLead } = await supabase.from('contatos').insert({
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

            // Prévia textual da última mensagem para o inbox (modelo WhatsApp Business).
            const preview: string = msg.text?.body || ({
              image: '📷 Foto', audio: '🎤 Áudio', video: '🎬 Vídeo',
              document: '📄 Documento', sticker: 'Figurinha', location: '📍 Localização',
            } as Record<string, string>)[msg.type] || '[Mídia]'

            if (!conv) {
              const { data: newConv } = await supabase.from('whatsapp_conversations').insert({
                organization_id: orgId,
                contact_phone: phone,
                contact_name: contactName,
                contato_id: leadId,
                last_message_at: new Date(msg.timestamp * 1000).toISOString(),
                last_message_preview: preview,
                last_message_direction: 'inbound',
                unread_count: 1
              }).select().single()
              conv = newConv
            } else {
              await supabase.from('whatsapp_conversations').update({
                last_message_at: new Date(msg.timestamp * 1000).toISOString(),
                last_message_preview: preview,
                last_message_direction: 'inbound',
                unread_count: (conv.unread_count || 0) + 1,
                contato_id: leadId
              }).eq('id', conv.id)
            }

            // Mídia (foto, áudio, vídeo, documento, figurinha): baixa e sobe
            // pro Storage antes de salvar, pra ter uma URL permanente.
            let messageContent: any = msg
            if (MEDIA_MESSAGE_TYPES.has(msg.type) && msg[msg.type]?.id && org.whatsapp_access_token) {
              const mediaUrl = await downloadAndStoreMedia(supabase, orgId, msg[msg.type].id, org.whatsapp_access_token)
              if (mediaUrl) messageContent = { ...msg, media_url: mediaUrl }
            }

            await supabase.from('whatsapp_messages').insert({
              conversation_id: conv.id,
              organization_id: orgId,
              direction: 'inbound',
              type: msg.type,
              content: messageContent,
              meta_message_id: msg.id,
              status: 'delivered'
            })

            if (leadId) {
              await supabase.from('contato_activities').insert({
                contato_id: leadId,
                organization_id: orgId,
                type: 'whatsapp_received',
                payload: { body: msg.text?.body || '[Mídia]', message_id: msg.id }
              })
            }

            // Fire push notification event (throttled in Inngest to 1/org/2min).
            await inngest.send({
              name: 'whatsapp/message.received',
              data: {
                orgId,
                contactName,
                messageBody: msg.text?.body || null,
              },
            })
          }
        }

        if (change.value.statuses) {
          for (const status of change.value.statuses) {
            await supabase.from('whatsapp_messages').update({ status: status.status }).eq('meta_message_id', status.id)
          }
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('WhatsApp Webhook error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
