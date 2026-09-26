'use client'

/**
 * Chat com o Traffic Agent (#22, passo 3.3) — consome o streaming NDJSON de
 * app/api/trafego/agent/chat/route.ts, mesmo padrão de consumo do
 * Orquestrador Global (components/features/OrchestratorPalette.tsx), mas
 * sem histórico persistido entre aberturas (fecha o painel, perde o chat —
 * mesmo trade-off já aceito no Orquestrador).
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Send, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToolCall = { name: string; input: unknown; result?: unknown }
type Message = { id: string; role: 'user' | 'assistant'; content: string; toolCalls: ToolCall[] }

export default function TrafficAgentChat({ orgSlug, clientId }: { orgSlug: string; clientId: string }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)

  async function send(message: string) {
    if (!message.trim() || streaming) return
    setInput('')
    setStreaming(true)

    const history = messages.map(m => ({ role: m.role, content: m.content }))
    setMessages(prev => [...prev, { id: `u-${Date.now()}`, role: 'user', content: message, toolCalls: [] }])
    const draftId = `a-${Date.now()}`
    setMessages(prev => [...prev, { id: draftId, role: 'assistant', content: '', toolCalls: [] }])

    let streamedText = ''
    const streamedTools: ToolCall[] = []

    try {
      const res = await fetch('/api/trafego/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgSlug, clientId, message, history }),
      })
      if (!res.ok || !res.body) {
        const errBody = await res.json().catch(() => null)
        throw new Error(errBody?.error || 'Falha ao conectar com o Traffic Agent')
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
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-3 pb-2">
        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground py-4 text-center">
            Pergunte sobre a operação deste cliente — ex.: &quot;por que o CPL subiu essa semana?&quot;
          </p>
        )}
        {messages.map(m => (
          <div key={m.id} className={cn('rounded-lg px-3 py-2 text-sm max-w-[90%]', m.role === 'user' ? 'bg-primary text-primary-foreground ml-auto' : 'bg-muted/50')}>
            <p className="whitespace-pre-wrap">{m.content || (streaming && m.role === 'assistant' ? '…' : '')}</p>
            {m.toolCalls.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {m.toolCalls.map((t, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-[10px] bg-background/60 rounded px-1.5 py-0.5 text-muted-foreground">
                    <Wrench className="w-2.5 h-2.5" /> {t.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <form
        onSubmit={e => { e.preventDefault(); send(input) }}
        className="flex items-end gap-2 border-t pt-2"
      >
        <Textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
          placeholder="Pergunte ao Traffic Agent..."
          className="text-sm min-h-[40px] max-h-[100px]"
          disabled={streaming}
        />
        <Button type="submit" size="icon" disabled={streaming || !input.trim()}>
          {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </form>
    </div>
  )
}
