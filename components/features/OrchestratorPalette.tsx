'use client'

/**
 * Orquestrador Global (issue #48) — aberto via mod+j (Ctrl+J / Cmd+J,
 * registrado na infraestrutura centralizada de atalhos, issue #10),
 * mantendo mod+k livre pra busca determinística (CommandPalette). Chat sem
 * sessão persistida — o histórico vive só enquanto o painel está montado
 * nesta sessão do navegador (ver app/api/orchestrator/chat/route.ts).
 */

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Sparkles, Send, X, Loader2, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useShortcut } from '@/components/features/ShortcutProvider'

type ToolCall = { name: string; input: Record<string, unknown>; result: unknown }
type Message = { id: string; role: 'user' | 'assistant'; content: string; toolCalls: ToolCall[] }

const SUGGESTED_PROMPTS = [
  'Quais leads importantes estão sem resposta?',
  'Quanto vendemos este mês?',
  'Resuma minha operação de hoje.',
]

const LINK_PATTERN = /(\*\*[^*]+\*\*)/g

function renderMarkdownLite(text: string): React.ReactNode {
  return text.split(LINK_PATTERN).map((part, i) =>
    /^\*\*[^*]+\*\*$/.test(part) ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>,
  )
}

export default function OrchestratorPalette({ orgSlug }: { orgSlug: string }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pathname = usePathname()

  useShortcut({
    combo: 'mod+j',
    description: 'Abrir Orquestrador de IA',
    group: 'Global',
    allowInTypingContext: true,
    handler: e => {
      e.preventDefault()
      setOpen(v => !v)
    },
  })

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  async function send(text: string) {
    const message = text.trim()
    if (!message || streaming) return
    setInput('')
    setStreaming(true)

    const history = messages.map(m => ({ role: m.role, content: m.content }))
    setMessages(prev => [...prev, { id: `u-${Date.now()}`, role: 'user', content: message, toolCalls: [] }])
    const draftId = `a-${Date.now()}`
    setMessages(prev => [...prev, { id: draftId, role: 'assistant', content: '', toolCalls: [] }])

    let streamedText = ''
    const streamedTools: ToolCall[] = []

    try {
      const res = await fetch('/api/orchestrator/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgSlug,
          message,
          history,
          pageContext: `Rota atual: ${pathname}. Título da página: ${typeof document !== 'undefined' ? document.title : ''}.`,
        }),
      })

      if (!res.ok || !res.body) {
        const errBody = await res.json().catch(() => null)
        throw new Error(errBody?.error || 'Falha ao conectar com o Orquestrador')
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

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh] sm:pt-[12vh] px-3">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px] animate-in fade-in duration-200" onClick={() => setOpen(false)} />

      <div className="relative z-10 w-full max-w-2xl max-h-[76vh] bg-background rounded-2xl border border-border/60 shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-[0.97] slide-in-from-top-2 duration-200 ease-out">
        <div className="h-14 shrink-0 border-b px-4 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-4.5 h-4.5 text-primary shrink-0" />
            <p className="text-sm font-semibold leading-tight tracking-tight">Orquestrador de IA</p>
          </div>
          <Button variant="ghost" size="icon" className="rounded-lg h-8 w-8" onClick={() => setOpen(false)} aria-label="Fechar orquestrador">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-[220px]">
          {messages.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Peça algo em qualquer módulo do CRM — sem precisar abrir a tela certa.</p>
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
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Peça algo ou pergunte sobre o negócio..."
              disabled={streaming}
              className="flex-1 h-9 text-[14px] border-none bg-transparent shadow-none focus-visible:ring-0"
            />
            <Button type="submit" size="icon" disabled={streaming || !input.trim()} className="h-9 w-9 shrink-0 rounded-lg">
              {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
