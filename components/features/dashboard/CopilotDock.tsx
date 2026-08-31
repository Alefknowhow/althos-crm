'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sparkles, Send, X, Loader2, Pin, Trash2, Plus, Pencil, Check, PanelLeft } from 'lucide-react'
import { getCopilotInit } from '@/actions/copilot'
import { pinCardToDashboard } from '@/actions/dashboard-layout'
import {
  listInsightsSessions, createInsightsSession, deleteInsightsSession, renameInsightsSession, listInsightsMessages,
} from '@/actions/ai_insights'
import { useCopilot } from '@/components/features/CopilotProvider'

const AnalyticsViewCard = dynamic(() => import('@/components/features/ai/AnalyticsViewCard'), {
  ssr: false,
  loading: () => <div className="h-24 rounded-xl bg-muted animate-pulse" />,
})

type ToolCall = { name: string; input: Record<string, any>; result: { summary: string; view: any } }
type Message = { id: string; role: 'user' | 'assistant' | 'system'; content: string; tool_calls: ToolCall[] | null }
type SessionSummary = { id: string; title: string | null; created_at: string; updated_at: string }

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

function formatSessionDate(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  if (isToday) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

/** Painel do Copiloto IA — aberto/fechado pelo botão da header
 * (CopilotTriggerButton), estado compartilhado via CopilotProvider (ver
 * app/app/[orgSlug]/layout.tsx). `period` é opcional: só o dashboard passa
 * (contexto de período selecionado no painel); nas demais telas o copiloto
 * funciona sem esse contexto extra. Layout em duas colunas (histórico à
 * esquerda, chat à direita), inspirado no claude.ai — no mobile a sidebar
 * vira um drawer sobreposto em vez de dividir a largura com o chat. */
export default function CopilotDock({ orgSlug, period }: { orgSlug: string; period?: string }) {
  const { open, setOpen } = useCopilot()
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
  const router = useRouter()
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || initialized) return
    startTransition(async () => {
      const [init, sessionList] = await Promise.all([getCopilotInit(orgSlug), listInsightsSessions(orgSlug)])
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

  // Sidebar de histórico vem aberta por padrão no desktop (pedido explícito:
  // histórico à esquerda, chat à direita); no mobile ela vira um drawer
  // sobreposto e começa fechada — senão cobre o chat inteiro na primeira
  // abertura.
  useEffect(() => {
    if (window.innerWidth < 640) setSidebarOpen(false)
  }, [])

  // Fecha com Escape, como qualquer overlay do app.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  async function refreshSessions() {
    const list = await listInsightsSessions(orgSlug)
    setSessions(list as SessionSummary[])
  }

  async function handlePin(title: string, view: any) {
    const res = await pinCardToDashboard(orgSlug, title, view)
    if (!res.ok) toast.error('Não foi possível fixar', { description: res.error })
    else {
      toast.success('Fixado no painel')
      router.refresh()
    }
  }

  async function switchToSession(id: string) {
    if (streaming || id === sessionId) return
    setSessionId(id)
    const msgs = await listInsightsMessages(orgSlug, id)
    setMessages(msgs as Message[])
  }

  async function handleNewConversation() {
    if (streaming) return
    const res = await createInsightsSession(orgSlug)
    if (!res.ok) { toast.error('Não foi possível criar conversa'); return }
    setSessionId(res.sessionId)
    setMessages([])
    refreshSessions()
  }

  async function handleDeleteSession(id: string) {
    const res = await deleteInsightsSession(orgSlug, id)
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
    const res = await renameInsightsSession(orgSlug, id, title)
    if (!res.ok) { toast.error('Não foi possível renomear', { description: res.error }); return }
    setSessions(prev => prev.map(s => s.id === id ? { ...s, title: title.trim() } : s))
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
          panelContext: period ? `Período selecionado no painel: ${period}.` : undefined,
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
      refreshSessions()
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
      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center sm:p-6 md:p-10">
          <div
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px] animate-in fade-in duration-200 hidden sm:block"
            onClick={() => setOpen(false)}
          />

          <div className="relative z-10 w-full h-full sm:h-[88vh] max-w-6xl bg-background sm:rounded-[28px] border-0 sm:border sm:border-border/60 shadow-none sm:shadow-2xl overflow-hidden flex animate-in fade-in sm:zoom-in-[0.97] slide-in-from-bottom-3 duration-300 ease-out">
            {/* ── Sidebar: histórico de conversas — inline no desktop,
                drawer sobreposto no mobile (a tela é estreita demais pra
                dividir espaço com o chat). ── */}
            {sidebarOpen && (
              <div
                className="absolute inset-0 z-20 bg-black/40 sm:hidden animate-in fade-in duration-150"
                onClick={() => setSidebarOpen(false)}
              />
            )}
            <div
              className={
                sidebarOpen
                  ? 'shrink-0 border-r bg-muted/30 flex flex-col overflow-hidden absolute inset-y-0 left-0 z-30 w-[85%] max-w-[320px] translate-x-0 transition-transform duration-200 ease-out sm:static sm:z-auto sm:w-[260px] sm:max-w-none sm:translate-x-0'
                  : 'shrink-0 border-r bg-muted/30 hidden overflow-hidden absolute inset-y-0 left-0 z-30 w-[85%] max-w-[320px] -translate-x-full transition-transform duration-200 ease-out sm:flex sm:flex-col sm:static sm:z-auto sm:w-0 sm:max-w-none sm:translate-x-0'
              }
            >
              <div className="h-16 shrink-0 flex items-center justify-between px-4">
                <span className="text-sm font-semibold tracking-tight">Conversas</span>
                <Button variant="ghost" size="icon" className="w-7 h-7 rounded-lg sm:hidden" onClick={() => setSidebarOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="px-3 pb-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2 rounded-xl h-9 text-sm font-normal border-border/70 hover:bg-background"
                  onClick={handleNewConversation}
                >
                  <Plus className="w-4 h-4" /> Nova conversa
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
                {sessions.map(s => (
                  <div
                    key={s.id}
                    className={`group flex items-center gap-1 rounded-xl px-2.5 py-2 text-sm cursor-pointer transition-colors ${
                      s.id === sessionId ? 'bg-background shadow-sm' : 'hover:bg-background/70'
                    }`}
                    onClick={() => renamingId !== s.id && switchToSession(s.id)}
                  >
                    {renamingId === s.id ? (
                      <>
                        <Input
                          autoFocus
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onClick={e => e.stopPropagation()}
                          onKeyDown={e => { if (e.key === 'Enter') confirmRename(); if (e.key === 'Escape') setRenamingId(null) }}
                          className="h-7 text-xs flex-1 rounded-lg"
                        />
                        <Button variant="ghost" size="icon" className="w-6 h-6 shrink-0 rounded-lg" onClick={e => { e.stopPropagation(); confirmRename() }}>
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0">
                          <p className="truncate leading-tight">{s.title || 'Nova conversa'}</p>
                          <p className="text-[10px] text-muted-foreground leading-tight">{formatSessionDate(s.updated_at)}</p>
                        </div>
                        <Button
                          variant="ghost" size="icon" className="w-6 h-6 shrink-0 rounded-lg opacity-0 group-hover:opacity-100"
                          onClick={e => { e.stopPropagation(); startRename(s) }}
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="w-6 h-6 shrink-0 rounded-lg opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                          onClick={e => { e.stopPropagation(); handleDeleteSession(s.id) }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </>
                    )}
                  </div>
                ))}
                {sessions.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-8">Nenhuma conversa ainda.</p>
                )}
              </div>
            </div>

            {/* ── Chat ── */}
            <div className="flex-1 flex flex-col min-w-0">
              <div className="h-16 shrink-0 border-b px-4 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Button variant="ghost" size="icon" className="rounded-lg" onClick={() => setSidebarOpen(v => !v)} title="Mostrar/ocultar histórico">
                    <PanelLeft className="w-4 h-4" />
                  </Button>
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-tight tracking-tight">Copiloto IA</p>
                    {credits != null && (
                      <p className="text-[11px] text-muted-foreground leading-tight">{credits} créditos restantes</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="rounded-lg" onClick={handleNewConversation} title="Nova conversa" aria-label="Nova conversa">
                    <Plus className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="rounded-lg" onClick={() => setOpen(false)} aria-label="Fechar copiloto">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                <div className="max-w-[720px] mx-auto px-6 sm:px-8 py-8 space-y-7">
                  {!enabled ? (
                    <div className="text-sm text-muted-foreground text-center py-8">
                      O copiloto não está disponível no seu plano.
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="pt-10 space-y-5">
                      <div className="space-y-1.5">
                        <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                          <Sparkles className="w-5 h-5" />
                        </div>
                        <h3 className="text-xl font-semibold tracking-tight">Como posso ajudar?</h3>
                        <p className="text-sm text-muted-foreground">Pergunte algo sobre o seu negócio.</p>
                      </div>
                      <div className="grid gap-2">
                        {SUGGESTED_PROMPTS.map(p => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => send(p)}
                            className="w-full text-left text-sm border border-border/70 rounded-2xl px-4 py-3 hover:bg-muted/60 hover:border-primary/40 transition-all"
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    messages.map(m => (
                      <div key={m.id}>
                        {m.role === 'user' ? (
                          <div className="flex justify-end">
                            <div className="max-w-[85%] rounded-3xl rounded-br-lg bg-primary text-primary-foreground px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap">
                              {m.content}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {m.tool_calls && m.tool_calls.length > 0 && m.tool_calls.map((tc, i) => (
                              <div key={i} className="space-y-1.5">
                                <AnalyticsViewCard view={tc.result.view} label={tc.name} />
                                {tc.result.view?.type !== 'none' && (
                                  <button
                                    type="button"
                                    onClick={() => handlePin(tc.name.replace('consultar_', ''), tc.result.view)}
                                    className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
                                  >
                                    <Pin className="w-3 h-3" /> Fixar no painel
                                  </button>
                                )}
                              </div>
                            ))}
                            {m.content && (
                              <div className="text-[15px] leading-7 text-foreground whitespace-pre-wrap">
                                {renderMarkdownLite(m.content)}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  {streaming && messages[messages.length - 1]?.content === '' && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">consultando os dados...</span>
                    </div>
                  )}
                  <div ref={endRef} />
                </div>
              </div>

              {enabled && (
                <div className="shrink-0 px-6 sm:px-8 pb-6 pt-2">
                  <form
                    onSubmit={handleSubmit}
                    className="max-w-[720px] mx-auto flex items-center gap-2 rounded-2xl border border-border/70 bg-muted/40 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/30 px-2 py-2 transition-colors"
                  >
                    <Input
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      placeholder="Pergunte sobre seu negócio..."
                      disabled={streaming || !sessionId}
                      className="flex-1 h-9 text-[15px] border-none bg-transparent shadow-none focus-visible:ring-0"
                    />
                    <Button type="submit" size="icon" disabled={streaming || !input.trim()} className="h-9 w-9 shrink-0 rounded-xl">
                      {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
