'use server'

/**
 * Transcrição de áudio genérica (ElevenLabs scribe_v1) — usada por QUALQUER
 * agente de IA do app que aceite entrada por voz (Copiloto, Criar
 * Formulário com IA, Testar Agente, Marketing Strategist, etc.), não só o
 * Copiloto. `actions/copilot.ts::transcribeCopilotAudio` continua existindo
 * pro Copiloto especificamente (checa a feature 'ai_insights' antes) — este
 * arquivo é o wrapper fino reaproveitado por todo o resto, sem acoplar a
 * nenhuma feature específica (a validação de crédito/feature de cada
 * agente já acontece na hora de GERAR a resposta, não na transcrição em si).
 */

import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { transcribeAudioElevenLabs } from '@/lib/ai/speech-to-text'

const MAX_AUDIO_BYTES = 15 * 1024 * 1024 // 15MB — mesmo teto do Copiloto

export async function transcribeAudio(orgSlug: string, formData: FormData): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  await requireAuth()
  await getCurrentOrganization(orgSlug)

  const file = formData.get('audio')
  if (!(file instanceof File)) return { ok: false, error: 'Áudio não recebido.' }
  if (file.size === 0) return { ok: false, error: 'Áudio vazio.' }
  if (file.size > MAX_AUDIO_BYTES) return { ok: false, error: 'Áudio muito longo.' }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const text = await transcribeAudioElevenLabs(buffer, file.name || 'audio.webm', file.type || 'audio/webm')
    return { ok: true, text }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Falha ao transcrever áudio.' }
  }
}
