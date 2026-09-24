'use client'

/**
 * Especialista de Projetos (issue #17 §7) — chat embutido na aba "Especialista
 * IA" do detalhe do Projeto (não um modal como o Orquestrador Global). Mesma
 * lógica de streaming/serialização de tool-calls de OrchestratorPalette.tsx,
 * adaptada pra um painel fixo em vez de overlay.
 */

import { useEffect, useRef, useState } from 'react'
import { Sparkles, Send, Loader2, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ProjectRow } from '@/actions/projects'

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

const LINK_PATTERN = /(\*\*[^*]+\*\*)/g
function renderMarkdownLite(text: string): React.ReactNode {
  return text.split(LINK_PATTERN).map((part, i) =>
    /^\*\*[^*]+\*\*$/.test(part) ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>,
  )
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    send(input)
  }

  return (
    <div className="rounded-lg border bg-card flex flex-col h-[520px]">
      <div className="h-12 shrink-0 border-b px-4 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary shrink-0" />
        <p className="text-sm font-semibold leading-tight tracking-tight">Especialista de Projetos</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Peça ajuda pra planejar, revisar ou avançar este projeto.</p>
            <div className="flex flex-col gap-2">
              {SUGGESTED_PROMPTS.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => send(p)}
                  className="text-left text-sm px-3 py-2 rounded-xl border border-border/60 bg-muted/30 hover:bg-muted/60 transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map(m => (
            <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div className={
                m.role === 'user'
                  ? 'max-w-[85%] rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-3.5 py-2 text-sm'
                  : 'max-w-[85%] rounded-2xl rounded-bl-sm bg-muted/50 px-3.5 py-2 text-sm space-y-1.5'
              }>
                {m.toolCalls.length > 0 && (
                  <div className="space-y-1">
                    {m.toolCalls.map((tc, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Wrench className="w-3 h-3 shrink-0" />
                        <span>{tc.name}</span>
                      </div>
                    ))}
                  </div>
                )}
                {m.content ? (
                  <p className="whitespace-pre-wrap leading-relaxed">{renderMarkdownLite(m.content)}</p>
                ) : streaming && m.role === 'assistant' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                ) : null}
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      <div className="shrink-0 px-4 pb-4 pt-2 border-t">
        <form onSubmit={handleSubmit} className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/40 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/30 px-2 py-1.5 transition-colors">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Peça algo sobre este projeto..."
            disabled={streaming}
            className="flex-1 h-9 text-[14px] border-none bg-transparent shadow-none focus-visible:ring-0"
          />
          <Button type="submit" size="icon" disabled={streaming || !input.trim()} className="h-9 w-9 shrink-0 rounded-lg">
            {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </form>
      </div>
    </div>
  )
}
