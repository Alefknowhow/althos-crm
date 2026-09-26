'use client'

/**
 * Especialista de Projetos (issue #17 §7) — chat embutido na aba "Especialista
 * IA" do detalhe do Projeto (não um modal como o Orquestrador Global). Mesma
 * lógica de streaming/serialização de tool-calls de OrchestratorPalette.tsx,
 * adaptada pra um painel fixo em vez de overlay.
 */

import { useEffect, useRef, useState } from 'react'
import { Sparkles, Wrench } from 'lucide-react'
import type { ProjectRow } from '@/actions/projects'
import { AIComposer } from '@/components/features/ai/AIComposer'
import { AIMessageBubble } from '@/components/features/ai/AIMessageBubble'
import { AIEmptyState } from '@/components/features/ai/AIEmptyState'

type ToolCall = { name: string; input: Record<string, unknown>; result: unknown }
type Message = { id: string; role: 'user' | 'assistant'; content: string; toolCalls: ToolCall[] }

/** Ver comentário equivalente em OrchestratorPalette.tsx — serializar as tool
 *  calls no texto da própria mensagem preserva o contexto de confirmação
 *  (confirm:true) entre turnos sem precisar de sessão persistida. */
function serializeMessageForHistory(m: Message): string {
  if (m.toolCalls.length === 0) return m.content
  const toolsSummary = m.toolCalls
    .map(tc => `- ${tc.name}(${JSON.stringify(tc.input)}) => ${JSON.stringify(tc.result)}`)
    .join('\n')
  return `${m.content}\n\n[ferramentas usadas nesta resposta]\n${toolsSummary}`
}

const SUGGESTED_PROMPTS = [
  'Quais tarefas estão atrasadas neste projeto?',
  'Sugira as próximas 3 tarefas pra avançar o projeto.',
  'Quais templates de projeto existem?',
]

export default function ProjectCopilotPanel({ orgSlug, project }: { orgSlug: string; project: ProjectRow }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  async function send(text: string) {
    const message = text.trim()
    if (!message || streaming) return
    setInput('')
    setStreaming(true)

    const history = messages.map(m => ({ role: m.role, content: serializeMessageForHistory(m) }))
    setMessages(prev => [...prev, { id: `u-${Date.now()}`, role: 'user', content: message, toolCalls: [] }])
    const draftId = `a-${Date.now()}`
    setMessages(prev => [...prev, { id: draftId, role: 'assistant', content: '', toolCalls: [] }])

    let streamedText = ''
    const streamedTools: ToolCall[] = []

    try {
      const res = await fetch(`/api/agenda/projetos/${project.id}/copilot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgSlug, message, history }),
      })

      if (!res.ok || !res.body) {
        const errBody = await res.json().catch(() => null)
        throw new Error(errBody?.error || 'Falha ao conectar com o Especialista de Projetos')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (!line.trim()) continue
          const event = JSON.parse(line)
          if (event.type === 'text_delta') {
            streamedText += event.text
            setMessages(prev => prev.map(m => (m.id === draftId ? { ...m, content: streamedText } : m)))
          } else if (event.type === 'tool_call') {
            streamedTools.push({ name: event.name, input: event.input, result: event.result })
            setMessages(prev => prev.map(m => (m.id === draftId ? { ...m, toolCalls: [...streamedTools] } : m)))
          } else if (event.type === 'error') {
            throw new Error(event.error)
          }
        }
      }
    } catch (e: any) {
      setMessages(prev => prev.map(m => (m.id === draftId ? { ...m, content: `Não foi possível responder: ${e?.message || 'erro desconhecido'}` } : m)))
    } finally {
      setStreaming(false)
    }
  }

  return (
    <div className="rounded-lg border bg-card flex flex-col h-[520px]">
      <div className="h-12 shrink-0 border-b px-4 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary shrink-0" />
        <p className="text-sm font-semibold leading-tight tracking-tight">Especialista de Projetos</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <AIEmptyState
            description="Peça ajuda pra planejar, revisar ou avançar este projeto."
            suggestions={SUGGESTED_PROMPTS}
            onSelectSuggestion={send}
          />
        ) : (
          messages.map(m => (
            <AIMessageBubble
              key={m.id}
              role={m.role}
              content={m.content}
              pending={streaming}
              toolCalls={m.toolCalls.length > 0 ? (
                <div className="space-y-1">
                  {m.toolCalls.map((tc, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Wrench className="w-3 h-3 shrink-0" />
                      <span>{tc.name}</span>
                    </div>
                  ))}
                </div>
              ) : undefined}
            />
          ))
        )}
        <div ref={endRef} />
      </div>

      <div className="shrink-0 px-4 pb-4 pt-2 border-t">
        <AIComposer
          orgSlug={orgSlug}
          value={input}
          onChange={setInput}
          onSend={() => send(input)}
          disabled={streaming}
          sending={streaming}
          placeholder="Peça algo sobre este projeto..."
        />
      </div>
    </div>
  )
}
