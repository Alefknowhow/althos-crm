'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sparkles, Send, X, User as UserIcon, Loader2, Pin } from 'lucide-react'
import { getCopilotInit } from '@/actions/copilot'
import { pinCardToDashboard } from '@/actions/dashboard-layout'

const AnalyticsViewCard = dynamic(() => import('@/components/features/ai/AnalyticsViewCard'), {
  ssr: false,
  loading: () => <div className="h-24 rounded-lg bg-muted animate-pulse" />,
})

type ToolCall = { name: string; input: Record<string, any>; result: { summary: string; view: any } }
type Message = { id: string; role: 'user' | 'assistant' | 'system'; content: string; tool_calls: ToolCall[] | null }

const SUGGESTED_PROMPTS = [
  'Onde estou perdendo mais leads no funil?',
  'Qual meu forecast de receita do mês?',
  'Resumo da semana',
]

function renderMarkdownLite(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) =>
    /^\*\*[^*]+\*\*$/.test(part) ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>,
  )
}

export default function CopilotDock({ orgSlug, period }: { orgSlug: string; period: string }) {
  const [open, setOpen] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [credits, setCredits] = useState<number | null>(null)
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [, startTransition] = useTransition()
  const router = useRouter()
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || initialized) return
    startTransition(async () => {
      const init = await getCopilotInit(orgSlug)
      setEnabled(init.enabled)
      setSessionId(init.sessionId)
      setMessages(init.messages as Message[])
      setCredits(init.creditsRemaining)
      setInitialized(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialized])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  async function handlePin(title: string, view: any) {
    const res = await pinCardToDashboard(orgSlug, title, view)
    if (!res.ok) toast.error('Não foi possível fixar', { description: res.error })
    else {
      toast.success('Fixado no painel')
      router.refresh()
    }
  }

  async function send(text: string) {
    const message = text.trim()
    if (!message || !sessionId || streaming) return
    setInput('')
    setStreaming(true)

    const userMsg: Message = { id: `tmp-${Date.now()}`, role: 'user', content: message, tool_calls: null }
    setMessages(prev => [...prev, userMsg])

    let streamedText = ''
    const streamedTools: ToolCall[] = []
    const draftId = `draft-${Date.now()}`
    setMessages(prev => [...prev, { id: draftId, role: 'assistant', content: '', tool_calls: [] }])

    try {
      const res = await fetch('/api/copilot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgSlug,
          sessionId,
          message,
          panelContext: `Período selecionado no painel: ${period}.`,
        }),
      })

      if (!res.ok || !res.body) {
        const errBody = await res.json().catch(() => null)
        throw new Error(errBody?.error || 'Falha ao conectar com o copiloto')
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
            setMessages(prev => prev.map(m => (m.id === draftId ? { ...m, tool_calls: [...streamedTools] } : m)))
          } else if (event.type === 'error') {
            toast.error('Copiloto', { description: event.error })
          }
        }
      }
      setCredits(c => (c != null ? Math.max(0, c - 2) : c))
    } catch (e: any) {
      toast.error('Não foi possível enviar', { description: e?.message })
      setMessages(prev => prev.filter(m => m.id !== draftId))
    } finally {
      setStreaming(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    send(input)
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-24 right-5 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:opacity-90 transition-opacity"
          aria-label="Abrir copiloto IA"
        >
          <Sparkles className="w-6 h-6" />
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-40 sm:inset-y-0 sm:right-0 sm:left-auto sm:w-[380px] bg-background border-l shadow-2xl flex flex-col">
          <div className="h-16 border-b px-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">Copiloto IA</p>
                {credits != null && (
                  <p className="text-[10px] text-muted-foreground leading-tight">{credits} créditos restantes</p>
                )}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Fechar copiloto">
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {!enabled ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                O copiloto não está disponível no seu plano.
              </div>
            ) : messages.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Pergunte algo sobre o seu negócio:</p>
                {SUGGESTED_PROMPTS.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => send(p)}
                    className="w-full text-left text-xs border rounded-lg px-3 py-2.5 hover:bg-muted hover:border-primary/40 transition-all"
                  >
                    {p}
                  </button>
                ))}
              </div>
            ) : (
              messages.map(m => (
                <div key={m.id} className={`flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div
                    className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center ${
                      m.role === 'user' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-primary/10 text-primary'
                    }`}
                  >
                    {m.role === 'user' ? <UserIcon className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                  </div>
                  <div className={`${m.role === 'user' ? 'max-w-[80%]' : 'max-w-[88%] flex-1'} space-y-2`}>
                    {m.tool_calls && m.tool_calls.length > 0 && m.tool_calls.map((tc, i) => (
                      <div key={i} className="space-y-1">
                        <AnalyticsViewCard view={tc.result.view} label={tc.name} />
                        {tc.result.view?.type !== 'none' && (
                          <button
                            type="button"
                            onClick={() => handlePin(tc.name.replace('consultar_', ''), tc.result.view)}
                            className="text-[10px] text-primary hover:underline inline-flex items-center gap-1"
                          >
                            <Pin className="w-2.5 h-2.5" /> Fixar no painel
                          </button>
                        )}
                      </div>
                    ))}
                    {m.content && (
                      <div
                        className={`rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap ${
                          m.role === 'user' ? 'bg-primary text-primary-foreground inline-block' : 'bg-muted'
                        }`}
                      >
                        {renderMarkdownLite(m.content)}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {streaming && messages[messages.length - 1]?.content === '' && (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div className="bg-muted rounded-2xl px-3.5 py-2 text-sm flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span className="text-muted-foreground text-xs">consultando os dados...</span>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {enabled && (
            <form onSubmit={handleSubmit} className="border-t bg-card p-3 flex gap-2 shrink-0">
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Pergunte sobre seu negócio..."
                disabled={streaming || !sessionId}
                className="flex-1 h-10 text-sm"
              />
              <Button type="submit" size="icon" disabled={streaming || !input.trim()} className="h-10 w-10 shrink-0">
                {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </form>
          )}
        </div>
      )}
    </>
  )
}
