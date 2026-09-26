'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Coins, X, Loader2, Check, Ban, Plus, PanelLeft } from 'lucide-react'
import {
  getFinancialAiInit, confirmFinancialAiEntry,
  listFinancialAiSessions, createFinancialAiSession, deleteFinancialAiSession,
  renameFinancialAiSession, listFinancialAiMessages,
} from '@/actions/financial-ai'
import { AIComposer } from '@/components/features/ai/AIComposer'
import { AIEmptyState } from '@/components/features/ai/AIEmptyState'
import { AIMessageBubble } from '@/components/features/ai/AIMessageBubble'
import { AIChatSidebar } from '@/components/features/ai/AIChatSidebar'
import { stripMarkdownTables } from '@/components/features/ai/markdownLite'

type FinancialAiView =
  | { type: 'kpis'; items: Array<{ label: string; value: string }> }
  | { type: 'table'; columns: string[]; rows: any[][] }
  | { type: 'confirm_entry'; draft: Record<string, any> }
  | { type: 'none' }

type ToolCall = { name: string; input: Record<string, any>; result: { summary: string; view: FinancialAiView } }
type Message = { id: string; role: 'user' | 'assistant' | 'system'; content: string; tool_calls: ToolCall[] | null }
type SessionSummary = { id: string; title: string | null; created_at: string; updated_at: string }

const SUGGESTED_PROMPTS = [
  'Como está o financeiro esse mês?',
  'Onde estou gastando mais?',
  'O que vence essa semana?',
]

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

/**
 * IA Financeira — mesmo formato de modal centralizado com histórico lateral
 * do Althos AI (CopilotDock.tsx), issue #68. Sessões/mensagens próprias
 * (ai_financial_sessions/ai_financial_messages), streaming via
 * app/api/financial-ai/chat/route.ts.
 */
export default function FinancialAiChat({ orgSlug }: { orgSlug: string }) {
  const [open, setOpen] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [credits, setCredits] = useState<number | null>(null)
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [, startTransition] = useTransition()
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || initialized) return
    startTransition(async () => {
      const [init, sessionList] = await Promise.all([getFinancialAiInit(orgSlug), listFinancialAiSessions(orgSlug)])
      setEnabled(init.enabled)
      setSessionId(init.sessionId)
      setMessages(init.messages as Message[])
      setCredits(init.creditsRemaining)
      setSessions(sessionList as SessionSummary[])
      setInitialized(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialized])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  useEffect(() => {
    if (window.innerWidth < 640) setSidebarOpen(false)
  }, [])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  async function refreshSessions() {
    const list = await listFinancialAiSessions(orgSlug)
    setSessions(list as SessionSummary[])
  }

  async function switchToSession(id: string) {
    if (streaming || id === sessionId) return
    setSessionId(id)
    const msgs = await listFinancialAiMessages(orgSlug, id)
    setMessages(msgs as Message[])
  }

  async function handleNewConversation() {
    if (streaming) return
    const res = await createFinancialAiSession(orgSlug)
    if (!res.ok) { toast.error('Não foi possível criar conversa'); return }
    setSessionId(res.sessionId)
    setMessages([])
    refreshSessions()
  }

  async function handleDeleteSession(id: string) {
    const res = await deleteFinancialAiSession(orgSlug, id)
    if (!res.ok) { toast.error('Não foi possível excluir', { description: res.error }); return }
    const remaining = sessions.filter(s => s.id !== id)
    setSessions(remaining)
    if (id === sessionId) {
      if (remaining.length > 0) switchToSession(remaining[0].id)
      else handleNewConversation()
    }
  }

  function startRename(s: SessionSummary) {
    setRenamingId(s.id)
    setRenameValue(s.title || 'Nova conversa')
  }

  async function confirmRename() {
    if (!renamingId) return
    const id = renamingId
    const title = renameValue
    setRenamingId(null)
    const res = await renameFinancialAiSession(orgSlug, id, title)
    if (!res.ok) { toast.error('Não foi possível renomear', { description: res.error }); return }
    setSessions(prev => prev.map(s => s.id === id ? { ...s, title: title.trim() } : s))
  }

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
      refreshSessions()
    } catch (e: any) {
      toast.error('Não foi possível enviar', { description: e?.message })
      setMessages(prev => prev.filter(m => m.id !== draftId))
    } finally {
      setStreaming(false)
    }
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
        <div className="fixed inset-0 z-40 flex items-center justify-center sm:p-6 md:p-10">
          <div
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px] animate-in fade-in duration-200 hidden sm:block"
            onClick={() => setOpen(false)}
          />

          <div className="relative z-10 w-full h-full sm:h-[88vh] max-w-6xl bg-background sm:rounded-[28px] border-0 sm:border sm:border-border/60 shadow-none sm:shadow-2xl overflow-hidden flex animate-in fade-in sm:zoom-in-[0.97] slide-in-from-bottom-3 duration-300 ease-out">
            <AIChatSidebar
              sidebarOpen={sidebarOpen}
              setSidebarOpen={setSidebarOpen}
              sessions={sessions}
              sessionId={sessionId}
              renamingId={renamingId}
              renameValue={renameValue}
              setRenameValue={setRenameValue}
              onNewConversation={handleNewConversation}
              onSwitchSession={switchToSession}
              onStartRename={startRename}
              onConfirmRename={confirmRename}
              onCancelRename={() => setRenamingId(null)}
              onDeleteSession={handleDeleteSession}
            />

            <div className="flex-1 flex flex-col min-w-0">
              <div className="h-16 shrink-0 border-b px-4 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Button variant="ghost" size="icon" className="rounded-lg h-9 w-9 sm:h-9 sm:w-9 max-sm:h-12 max-sm:w-12" onClick={() => setSidebarOpen(v => !v)} title="Mostrar/ocultar histórico">
                    <PanelLeft className="w-4 h-4" />
                  </Button>
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Coins className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-tight tracking-tight">IA Financeira</p>
                    {credits != null && (
                      <p className="text-[11px] text-muted-foreground leading-tight">{credits} créditos restantes</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="rounded-lg h-9 w-9 sm:h-9 sm:w-9 max-sm:h-12 max-sm:w-12" onClick={handleNewConversation} title="Nova conversa" aria-label="Nova conversa">
                    <Plus className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="rounded-lg h-9 w-9 sm:h-9 sm:w-9 max-sm:h-12 max-sm:w-12" onClick={() => setOpen(false)} aria-label="Fechar IA financeira">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                <div className="max-w-[720px] mx-auto px-6 sm:px-8 py-8 space-y-7">
                  {!enabled ? (
                    <div className="text-sm text-muted-foreground text-center py-8">
                      A IA financeira não está disponível no seu plano.
                    </div>
                  ) : messages.length === 0 ? (
                    <AIEmptyState
                      icon={<div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3"><Coins className="w-5 h-5" /></div>}
                      description="Pergunte sobre o financeiro ou peça pra registrar um lançamento — a IA nunca grava dados sem sua confirmação."
                      suggestions={SUGGESTED_PROMPTS}
                      onSelectSuggestion={send}
                    />
                  ) : (
                    messages.map(m => {
                      const hasDataCard = !!m.tool_calls?.some(tc => tc.result?.view && tc.result.view.type !== 'none')
                      const displayContent = hasDataCard ? stripMarkdownTables(m.content) : m.content
                      return (
                        <AIMessageBubble
                          key={m.id}
                          role={m.role}
                          content={displayContent}
                          pending={streaming}
                          toolCalls={m.tool_calls && m.tool_calls.length > 0 ? (
                            <div className="space-y-1.5">
                              {m.tool_calls.map((tc, i) => (
                                tc.result?.view && tc.result.view.type !== 'none' ? (
                                  <ViewCard key={i} view={tc.result.view} orgSlug={orgSlug} />
                                ) : null
                              ))}
                            </div>
                          ) : undefined}
                        />
                      )
                    })
                  )}
                  <div ref={endRef} />
                </div>
              </div>

              {enabled && (
                <div className="shrink-0 px-6 sm:px-8 pb-6 pt-2">
                  <div className="max-w-[720px] mx-auto">
                    <AIComposer
                      orgSlug={orgSlug}
                      value={input}
                      onChange={setInput}
                      onSend={() => send(input)}
                      disabled={streaming || !sessionId}
                      sending={streaming}
                      placeholder="Pergunte ou peça pra lançar algo..."
                      autoFocus
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
