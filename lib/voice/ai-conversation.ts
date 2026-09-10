/**
 * Motor de conversa do Voice AI — reaproveita INTEGRALMENTE o motor pure-
 * function já existente em lib/ai/attendant-engine.ts (respondAsAttendant),
 * já que ele é agnóstico de canal: recebe mensagens + tools + executeTool e
 * devolve texto (com tool-calling). O WhatsApp o alimenta com texto vindo da
 * Meta API; o Voice AI alimenta com texto vindo de Speech-to-Text.
 *
 * IMPORTANTE (limite arquitetural real, não um atalho): a conversa de voz em
 * TEMPO REAL (ouvir → transcrever → responder → falar, com possibilidade de
 * interrupção) precisa de um socket persistente falando com o provider de
 * telefonia (Twilio ConversationRelay ou Media Streams). Functions
 * serverless da Vercel não sustentam uma conexão WebSocket de longa duração
 * — a integração de produção requer um serviço à parte (ex.: um processo
 * Node dedicado, Fly.io/Railway/um container) que fala WebSocket com a
 * Twilio de um lado e chama runVoiceAgentTurn() abaixo do outro. Esta função
 * é o ponto de integração pronto pra isso: recebe texto transcrito de UM
 * turno da conversa e devolve o texto que deve ser sintetizado em voz.
 */
import { createAdminClient } from '../supabase/server'
import { getPlatformAiKey } from '../ai/api-key'
import { respondAsAttendant } from '../ai/attendant-engine'
import { toolsForAgent, executeVoiceAgentTool } from './ai-tools'
import { buildVoiceLeadProfile } from './ai-context-builder'

export interface VoiceTurnResult {
  replyText: string
  transferRequested: boolean
  qualified?: boolean
}

export async function runVoiceAgentTurn(opts: {
  voiceCallId: string
  organizationId: string
  history: { role: 'user' | 'assistant'; content: string }[]
  userSpeech: string
}): Promise<VoiceTurnResult> {
  const admin = createAdminClient()
  const { data: call } = await admin.from('voice_calls').select('contato_id, ai_agent_id').eq('id', opts.voiceCallId).maybeSingle()
  if (!call?.ai_agent_id) throw new Error('Chamada sem agente de Voice AI associado.')

  const { data: agent } = await admin.from('voice_ai_agents').select('*').eq('id', call.ai_agent_id).maybeSingle()
  if (!agent) throw new Error('Agente de Voice AI não encontrado.')

  const leadProfile = call.contato_id ? await buildVoiceLeadProfile(admin, opts.organizationId, call.contato_id) : null
  const allowedTools: string[] = Array.isArray(agent.allowed_tools) ? agent.allowed_tools : []
  const tools = toolsForAgent(allowedTools)

  const personaPrompt = agent.persona_prompt || `Você é ${agent.name}, ${agent.role_label || 'assistente de atendimento por voz'}. Objetivo: ${agent.objective || 'atender bem o cliente'}. Tom: ${agent.tone}.`

  const result = await respondAsAttendant(
    {
      personaPrompt,
      leadProfile,
      handoffPhrases: ['falar com humano', 'atendente', 'pessoa de verdade'],
      messages: [...opts.history, { role: 'user', content: opts.userSpeech }],
      tools,
      executeTool: (name, input) => executeVoiceAgentTool(name, input, {
        orgId: opts.organizationId,
        contatoId: call.contato_id,
        voiceCallId: opts.voiceCallId,
        allowedTools,
        supabase: admin,
      }),
    },
    { apiKey: getPlatformAiKey(), model: agent.model },
  )

  const transferRequested = result.toolCalls.some(t => t.name === 'transfer_call')
  return { replyText: result.reply, transferRequested }
}
