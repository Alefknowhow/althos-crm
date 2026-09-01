'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Coins, Send, X, User as UserIcon, Loader2, Check, Ban } from 'lucide-react'
import { getFinancialAiInit, confirmFinancialAiEntry } from '@/actions/financial-ai'

type FinancialAiView =
  | { type: 'kpis'; items: Array<{ label: string; value: string }> }
  | { type: 'table'; columns: string[]; rows: any[][] }
  | { type: 'confirm_entry'; draft: Record<string, any> }
  | { type: 'none' }

type ToolCall = { name: string; input: Record<string, any>; result: { summary: string; view: FinancialAiView } }
type Message = { id: string; role: 'user' | 'assistant' | 'system'; content: string; tool_calls: ToolCall[] | null }

const SUGGESTED_PROMPTS = [
  'Como está o financeiro esse mês?',
  'Onde estou gastando mais?',
  'O que vence essa semana?',
]

function renderMarkdownLite(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) =>
    /^\*\*[^*]+\*\*$/.test(part) ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>,
  )
}

function ViewCard({ view, orgSlug }: { view: FinancialAiView; orgSlug: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [resolved, setResolved] = useState<'confirmed' | 'discarded' | null>(null)

  if (view.type === 'kpis') {
    return (
      <div className="grid grid-cols-2 gap-2 rounded-lg border p-2.5 text-xs">
        {view.items.map(item => (
          <div key={item.label}>
            <p className="text-muted-foreground truncate">{item.label}</p>
            <p className="font-semibold">{item.value}</p>
          </div>
        ))}
      </div>
    )
  }

  if (view.type === 'table') {
    return (
      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/40">
              {view.columns.map(c => <th key={c} className="text-left px-2 py-1.5 font-medium">{c}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y">
            {view.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => <td key={j} className="px-2 py-1.5 whitespace-nowrap">{String(cell)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (view.type === 'confirm_entry') {
    const d = view.draft
    if (resolved === 'confirmed') {
      return <div className="rounded-lg border border-success/40 bg-success/5 p-2.5 text-xs text-success flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> Lançamento gravado.</div>
    }
    if (resolved === 'discarded') {
      return <div className="rounded-lg border p-2.5 text-xs text-muted-foreground flex items-center gap-1.5"><Ban className="w-3.5 h-3.5" /> Descartado.</div>
    }
    return (
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5 space-y-2 text-xs">
        <p className="font-medium">Confirmar novo lançamento?</p>
        <dl className="space-y-1">
          <div className="flex justify-between"><dt className="text-muted-foreground">Tipo</dt><dd>{d.tipo}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">Categoria</dt><dd>{d.categoria}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">Valor</dt><dd>R$ {(d.valor_cents / 100).toFixed(2)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">Competência</dt><dd>{d.competencia}</dd></div>
          {d.vencimento && <div className="flex justify-between"><dt className="text-muted-foreground">Vencimento</dt><dd>{d.vencimento}</dd></div>}
          {d.observacoes && <div className="flex justify-between gap-2"><dt className="text-muted-foreground shrink-0">Obs.</dt><dd className="text-right">{d.observacoes}</dd></div>}
        </dl>
        <div className="flex gap-1.5 pt-1">
          <Button size="sm" variant="outline" className="h-7 text-xs flex-1" disabled={confirming} onClick={() => setResolved('discarded')}>Descartar</Button>
          <Button
            size="sm"
            className="h-7 text-xs flex-1"
            disabled={confirming}
            onClick={async () => {
              setConfirming(true)
              const res = await confirmFinancialAiEntry(orgSlug, d)
              setConfirming(false)
              if (!res.ok) { toast.error(res.error); return }
              toast.success('Lançamento criado')
              setResolved('confirmed')
              router.refresh()
            }}
          >
            {confirming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirmar'}
          </Button>
        </div>
      </div>
    )
  }

  return null
}

export default function FinancialAiChat({ orgSlug }: { orgSlug: string }) {
  const [open, setOpen] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [credits, setCredits] = useState<number | null>(null)
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [, startTransition] = useTransition()
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || initialized) return
    startTransition(async () => {
      const init = await getFinancialAiInit(orgSlug)
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

  async function send(text: string) {
    const message = text.trim()
    if (!message || !sessionId || streaming) return
    setInput('')
    setStreaming(true)

    setMessages(prev => [...prev, { id: `tmp-${Date.now()}`, role: 'user', content: message, tool_calls: null }])

    let streamedText = ''
    const streamedTools: ToolCall[] = []
    const draftId = `draft-${Date.now()}`
    setMessages(prev => [...prev, { id: draftId, role: 'assistant', content: '', tool_calls: [] }])

    try {
      const res = await fetch('/api/financial-ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgSlug, sessionId, message }),
      })

      if (!res.ok || !res.body) {
        const errBody = await res.json().catch(() => null)
        throw new Error(errBody?.error || 'Falha ao conectar com a IA')
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
            toast.error('IA financeira', { description: event.error })
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
          className="fixed bottom-24 right-5 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity"
          aria-label="Abrir IA financeira"
        >
          <Coins className="w-6 h-6" />
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-40 sm:inset-y-0 sm:right-0 sm:left-auto sm:w-1/2 sm:min-w-[420px] sm:max-w-3xl bg-background border-l flex flex-col">
          <div className="h-16 border-b px-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <Coins className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">IA Financeira</p>
                {credits != null && (
                  <p className="text-[10px] text-muted-foreground leading-tight">{credits} créditos restantes</p>
                )}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Fechar IA financeira">
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {!enabled ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                A IA financeira não está disponível no seu plano.
              </div>
            ) : messages.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Pergunte sobre o financeiro ou peça pra registrar um lançamento:</p>
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
                <Badge variant="outline" className="text-[10px]">A IA nunca grava dados sem sua confirmação</Badge>
              </div>
            ) : (
              messages.map(m => (
                <div key={m.id} className={`flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div
                    className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center ${
                      m.role === 'user' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-primary/10 text-primary'
                    }`}
                  >
                    {m.role === 'user' ? <UserIcon className="w-3.5 h-3.5" /> : <Coins className="w-3.5 h-3.5" />}
                  </div>
                  <div className={`${m.role === 'user' ? 'max-w-[80%]' : 'max-w-[88%] flex-1'} space-y-2`}>
                    {m.tool_calls && m.tool_calls.length > 0 && m.tool_calls.map((tc, i) => (
                      tc.result?.view && tc.result.view.type !== 'none' ? (
                        <ViewCard key={i} view={tc.result.view} orgSlug={orgSlug} />
                      ) : null
                    ))}
                    {m.content && (
                      <div
                        className={`rounded-none px-3.5 py-2 text-sm whitespace-pre-wrap ${
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
                  <Coins className="w-3.5 h-3.5" />
                </div>
                <div className="bg-muted rounded-none px-3.5 py-2 text-sm flex items-center gap-2">
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
                placeholder="Pergunte ou peça pra lançar algo..."
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
