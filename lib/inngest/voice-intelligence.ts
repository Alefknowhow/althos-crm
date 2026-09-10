/**
 * Fase 5 — Intelligence: transcrição (Gemini, sobre o áudio da gravação) e
 * geração de resumo/insights/Call Score (Claude, sobre o texto transcrito).
 * Disparado depois que a gravação fica pronta (ver
 * app/api/webhooks/voice/twilio/recording/route.ts).
 */
import { inngest } from './client'
import { createAdminClient } from '../supabase/server'
import { transcribeRecording } from '../voice/transcription'
import { generateCallInsights } from '../voice/insights'

export const requestVoiceTranscriptionFn = inngest.createFunction(
  { id: 'voice-transcribe-recording', name: 'Althos Voice: transcrever gravação', retries: 2, triggers: [{ event: 'voice/transcription.requested' }] },
  async ({ event, step }) => {
    const { voiceCallId, organizationId } = event.data as { voiceCallId: string; organizationId: string }

    const result = await step.run('transcribe', async () => {
      const admin = createAdminClient()
      const { data: recording } = await admin.from('voice_recordings').select('url').eq('voice_call_id', voiceCallId).maybeSingle()
      if (!recording?.url) return { skipped: 'no-recording' }

      const transcript = await transcribeRecording(recording.url)
      await admin.from('voice_transcripts').upsert(
        { organization_id: organizationId, voice_call_id: voiceCallId, full_text: transcript.fullText, segments: transcript.segments },
        { onConflict: 'voice_call_id' },
      )
      return { transcribed: true }
    })

    if (!('skipped' in result)) {
      await inngest.send({ name: 'voice.transcript.ready', data: { voiceCallId, organizationId } })
    }
    return result
  },
)

export const generateCallInsightsFn = inngest.createFunction(
  { id: 'voice-generate-insights', name: 'Althos Voice: gerar resumo e insights', retries: 2, triggers: [{ event: 'voice.transcript.ready' }] },
  async ({ event, step }) => {
    const { voiceCallId, organizationId } = event.data as { voiceCallId: string; organizationId: string }

    return step.run('generate-insights', async () => {
      const admin = createAdminClient()
      const { data: transcript } = await admin.from('voice_transcripts').select('full_text').eq('voice_call_id', voiceCallId).maybeSingle()
      if (!transcript?.full_text) return { skipped: 'no-transcript' }

      const insights = await generateCallInsights(transcript.full_text)
      await admin.from('voice_call_insights').upsert({ organization_id: organizationId, voice_call_id: voiceCallId, ...insights }, { onConflict: 'voice_call_id' })
      await admin.from('voice_calls').update({ outcome: insights.outcome }).eq('id', voiceCallId)

      if (insights.outcome === 'qualificado') {
        const { data: call } = await admin.from('voice_calls').select('contato_id').eq('id', voiceCallId).maybeSingle()
        if (call?.contato_id) {
          await inngest.send({ name: 'voice.ai.qualified', data: { orgId: organizationId, leadId: call.contato_id, voiceCallId } })
        }
      }

      return { insightsGenerated: true }
    })
  },
)
