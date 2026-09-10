/**
 * Tools que um agente de Voice AI pode executar durante uma ligação — mesmo
 * padrão de lib/ai/attendant-tools.ts (definição JSON-schema + executor
 * server-side). A diferença chave: cada agente tem uma allowlist explícita
 * (voice_ai_agents.allowed_tools) e o enforcement é feito AQUI, no
 * executor — nunca confiar que o prompt sozinho vai respeitar os limites.
 */
import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'

export type VoiceToolContext = {
  orgId: string
  contatoId: string | null
  voiceCallId: string
  allowedTools: string[]
  supabase: SupabaseClient
}

export const VOICE_AGENT_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: 'get_contact',
    description: 'Busca dados do contato atual (nome, telefone, tags, estágio do pipeline, responsável).',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_contact_history',
    description: 'Busca o histórico recente de atividades do contato (últimas mensagens, ligações, notas).',
    input_schema: { type: 'object', properties: { limit: { type: 'number', description: 'Máximo de itens (padrão 10).' } } },
  },
  {
    name: 'add_note',
    description: 'Registra uma observação/nota na timeline do contato.',
    input_schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  },
  {
    name: 'create_task',
    description: 'Cria uma tarefa de follow-up vinculada ao contato.',
    input_schema: { type: 'object', properties: { title: { type: 'string' }, due_date: { type: 'string', description: 'YYYY-MM-DD, opcional' } }, required: ['title'] },
  },
  {
    name: 'update_pipeline_stage',
    description: 'Move o contato para outro estágio do funil de vendas.',
    input_schema: { type: 'object', properties: { stage_name: { type: 'string' } }, required: ['stage_name'] },
  },
  {
    name: 'transfer_call',
    description: 'Transfere a ligação para um atendente humano quando o cliente pede negociação específica, reclamação, ou algo fora do escopo do agente.',
    input_schema: { type: 'object', properties: { reason: { type: 'string' } }, required: ['reason'] },
  },
]

/**
 * Filtra a lista de tools pela allowlist do agente antes de enviar ao LLM —
 * o modelo nem sabe que uma tool proibida existe.
 */
export function toolsForAgent(allowedTools: string[]): Anthropic.Messages.Tool[] {
  return VOICE_AGENT_TOOLS.filter(t => allowedTools.includes(t.name))
}

export async function executeVoiceAgentTool(
  name: string,
  input: Record<string, unknown>,
  ctx: VoiceToolContext,
): Promise<string> {
  // Segunda trava: mesmo que o modelo tente chamar uma tool fora da
  // allowlist (alucinação, prompt injection do interlocutor), o backend
  // recusa aqui.
  if (!ctx.allowedTools.includes(name)) {
    return `[ERRO: esta ação (${name}) não está autorizada para este agente]`
  }

  try {
    switch (name) {
      case 'get_contact': {
        if (!ctx.contatoId) return '[Nenhum contato vinculado a esta ligação]'
        const { data } = await ctx.supabase.from('contatos').select('name, phone, tags, status, pipeline_stages(name)').eq('id', ctx.contatoId).maybeSingle()
        return data ? JSON.stringify(data) : '[Contato não encontrado]'
      }
      case 'get_contact_history': {
        if (!ctx.contatoId) return '[Nenhum contato vinculado a esta ligação]'
        const limit = typeof input.limit === 'number' ? input.limit : 10
        const { data } = await ctx.supabase.from('contato_activities').select('type, payload, created_at').eq('contato_id', ctx.contatoId).order('created_at', { ascending: false }).limit(limit)
        return JSON.stringify(data ?? [])
      }
      case 'add_note': {
        if (!ctx.contatoId) return '[Nenhum contato vinculado a esta ligação]'
        await ctx.supabase.from('contato_activities').insert({ organization_id: ctx.orgId, contato_id: ctx.contatoId, type: 'note', payload: { text: input.text } })
        return '[Nota registrada]'
      }
      case 'create_task': {
        if (!ctx.contatoId) return '[Nenhum contato vinculado a esta ligação]'
        await ctx.supabase.from('tasks').insert({ organization_id: ctx.orgId, contato_id: ctx.contatoId, title: input.title, due_date: input.due_date ?? null, status: 'pending' })
        return '[Tarefa criada]'
      }
      case 'update_pipeline_stage': {
        if (!ctx.contatoId) return '[Nenhum contato vinculado a esta ligação]'
        const { data: stage } = await ctx.supabase.from('pipeline_stages').select('id').eq('organization_id', ctx.orgId).ilike('name', `%${input.stage_name}%`).maybeSingle()
        if (!stage) return `[Estágio "${input.stage_name}" não encontrado]`
        await ctx.supabase.from('contatos').update({ stage_id: stage.id }).eq('id', ctx.contatoId)
        return '[Estágio atualizado]'
      }
      case 'transfer_call': {
        await ctx.supabase.from('voice_calls').update({ outcome: 'transferido_para_humano' }).eq('id', ctx.voiceCallId)
        return `[Transferência solicitada: ${input.reason}]`
      }
      default:
        return `[ERRO: tool desconhecida: ${name}]`
    }
  } catch (err: any) {
    return `[ERRO: ${err?.message || 'falha ao executar a ação'}]`
  }
}
