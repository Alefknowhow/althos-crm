import { NextResponse } from 'next/server'
import twilio from 'twilio'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * Webhook chamado pela Twilio quando o CLIENTE atende a ligação de saída
 * disparada por lib/inngest/voice-calls.ts. Responde com TwiML que conecta
 * a chamada ao Twilio Client do agente que a originou (identity = user_id,
 * vindo na querystring — ver placeVoiceCallFn). O agente recebe essa conexão
 * no navegador via Device.on('incoming') (Twilio Voice SDK), no
 * ActiveCallBar.
 */
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url)
  const voiceCallId = searchParams.get('voiceCallId')
  const agentIdentity = searchParams.get('agentIdentity')

  const rawBody = await req.text()
  const params = Object.fromEntries(new URLSearchParams(rawBody))

  const twiml = new twilio.twiml.VoiceResponse()

  if (voiceCallId) {
    const admin = createAdminClient()
    const { data: call } = await admin.from('voice_calls').select('organization_id, human_or_ai').eq('id', voiceCallId).maybeSingle()
    if (call) {
      const valid = await verifyTwilioSignature(call.organization_id, req.url, params, req.headers.get('X-Twilio-Signature'))
      if (!valid) return new NextResponse('Forbidden', { status: 403 })
    }
    await admin.from('voice_calls').update({ status: 'in_progress', answered_at: new Date().toISOString() }).eq('id', voiceCallId)

    if (call?.human_or_ai === 'ai') {
      // ConversationRelay conecta o áudio da chamada a um WebSocket que fala
      // com lib/voice/ai-conversation.ts::runVoiceAgentTurn(). Esse WebSocket
      // NÃO pode viver numa function serverless da Vercel (precisa de conexão
      // persistente) — a URL abaixo aponta pro serviço dedicado configurado
      // em VOICE_RELAY_WS_URL (fora do deploy do Next.js). Ver comentário
      // completo em lib/voice/ai-conversation.ts.
      const relayUrl = process.env.VOICE_RELAY_WS_URL
      if (relayUrl) {
        const connect = twiml.connect()
        ;(connect as any).conversationRelay({ url: `${relayUrl}?voiceCallId=${voiceCallId}`, language: 'pt-BR' })
      } else {
        twiml.say({ language: 'pt-BR' }, 'O agente de inteligência artificial ainda não está configurado nesta organização.')
        twiml.hangup()
      }
      return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } })
    }
  }

  if (agentIdentity) {
    twiml.dial().client(agentIdentity)
  } else {
    twiml.say({ language: 'pt-BR' }, 'Não foi possível conectar a chamada.')
    twiml.hangup()
  }

  return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } })
}

async function verifyTwilioSignature(organizationId: string, url: string, params: Record<string, string>, signature: string | null): Promise<boolean> {
  if (!signature) return false
  const admin = createAdminClient()
  const { data: account } = await admin.from('voice_accounts').select('id').eq('organization_id', organizationId).maybeSingle()
  if (!account) return false
  const { data: creds } = await admin.from('voice_provider_credentials').select('auth_token').eq('voice_account_id', account.id).maybeSingle()
  if (!creds) return false
  return twilio.validateRequest(creds.auth_token, signature, url, params)
}
