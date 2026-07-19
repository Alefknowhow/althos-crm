'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Bot,
  Send,
  Plus,
  Trash2,
  Settings,
  Sparkles,
  User as UserIcon,
  AlertTriangle,
  Loader2,
  Wrench,
  ChevronDown,
  ChevronUp,
  PanelLeft,
  X,
} from 'lucide-react'
import {
  sendSandboxMessage,
  createSandboxSession,
  deleteSandboxSession,
} from '@/actions/ai_attendant'

type Message = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  tokens_input: number | null
  tokens_output: number | null
  cache_read_tokens: number | null
  cost_cents: number | null
  model: string | null
  created_at: string
}

type SandboxSession = {
  id: string
  title: string | null
  simulated_lead: any
  created_at: string
  updated_at: string
}

type Props = {
  orgSlug: string
  hasApiKey: boolean
  attendantEnabled: boolean
  sessions: SandboxSession[]
  activeSessionId: string
  initialMessages: Message[]
}

function fmtCostBRL(usdCents: number | null | undefined): string {
  if (!usdCents) return '—'
  // Quick USD→BRL conversion at ~R$5.0. For accurate FX, store/fetch a rate.
  const brl = (usdCents / 100) * 5.0
  if (brl < 0.01) return '< R$ 0,01'
  return `R$ ${brl.toFixed(4)}`
}

type ToolCallRecord = { name: string; input: Record<string, any>; output: string }

export default function SandboxPlayground({
  orgSlug,
  hasApiKey,
  attendantEnabled,
  sessions,
  activeSessionId,
  initialMessages,
}: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [messages, setMessages] = useState(initialMessages)
  // Tool calls aren't persisted in the DB (yet) so we keep them keyed by
  // message id in component state. Cleared when the session changes.
  const [toolCallsByMessageId, setToolCallsByMessageId] = useState<Record<string, ToolCallRecord[]>>({})
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null)
  // Mobile: one pane at a time. 'chat' is the default; the user opens the
  // session list with the header button.
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('chat')

  // Auto-scroll to bottom when messages change.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  async function send() {
    if (!input.trim() || sending || !activeSessionId) return
    if (!hasApiKey) {
      toast.error('Cadastre a chave da Anthropic em Configurações → IA antes de testar.')
      return
    }
    const userText = input.trim()
    setInput('')
    setSending(true)

    // Optimistic: append user message right away.
    const optimisticId = `tmp-${Date.now()}`
    setMessages(prev => [
      ...prev,
      {
        id: optimisticId,
        role: 'user',
        content: userText,
        tokens_input: null,
        tokens_output: null,
        cache_read_tokens: null,
        cost_cents: null,
        model: null,
        created_at: new Date().toISOString(),
      },
    ])

    const res = await sendSandboxMessage(orgSlug, activeSessionId, userText)
    setSending(false)

    if (!res.ok) {
      toast.error(res.error || 'Erro')
      // Reload from server to reconcile.
      router.refresh()
      return
    }

    // Replace optimistic message with the assistant reply.
    if (res.assistantMessage) {
      const assistantMsg = res.assistantMessage as Message
      setMessages(prev => [...prev, assistantMsg])
      if (res.toolCalls && res.toolCalls.length > 0) {
        setToolCallsByMessageId(prev => ({
          ...prev,
          [assistantMsg.id]: res.toolCalls as ToolCallRecord[],
        }))
      }
    }

    if (res.handoffRequested) {
      toast.warning('A IA detectou um pedido de handoff para humano. Em produção, escalaria.', {
        duration: 6000,
      })
    }
  }

  async function newSession() {
    const res = await createSandboxSession(orgSlug)
    if (res.ok) {
      startTransition(() =>
        router.push(`/app/${orgSlug}/configuracoes/agente-ia?tab=testar&session=${res.sessionId}`),
      )
    } else {
      toast.error(res.error || 'Erro')
    }
  }

  async function deleteSession(sessionId: string) {
    const res = await deleteSandboxSession(orgSlug, sessionId)
    if (res.ok) {
      toast.success('Removida')
      // If deleted active, navigate away.
      if (sessionId === activeSessionId) {
        startTransition(() => router.push(`/app/${orgSlug}/configuracoes/agente-ia?tab=testar`))
      } else {
        router.refresh()
      }
    } else {
      toast.error(res.error || 'Erro')
    }
  }

  return (
    <div className="h-full flex">
      {/* Sidebar with sessions */}
      <aside className={`w-full md:w-72 border-r bg-muted/20 flex-col ${mobileView === 'list' ? 'flex' : 'hidden'} md:flex`}>
        <div className="p-4 border-b">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h2 className="font-semibold text-sm">Testar Agente</h2>
            <div className="flex items-center gap-1">
              <Link
                href={`/app/${orgSlug}/configuracoes/agente-ia`}
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 p-1"
              >
                <Settings className="w-3.5 h-3.5" />
              </Link>
              <button
                type="button"
                onClick={() => setMobileView('chat')}
                className="md:hidden p-1 rounded-md hover:bg-muted text-muted-foreground"
                aria-label="Fechar lista"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Teste a persona antes de conectar WhatsApp.
          </p>
          <Button size="sm" className="w-full" onClick={newSession}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Nova conversa
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              Sem conversas ainda.
            </p>
          ) : (
            sessions.map(s => {
              const active = s.id === activeSessionId
              return (
                <div
                  key={s.id}
                  className={`group rounded-md text-xs flex items-center justify-between gap-1 ${
                    active ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted'
                  }`}
                >
                  <Link
                    href={`/app/${orgSlug}/configuracoes/agente-ia?tab=testar&session=${s.id}`}
                    onClick={() => setMobileView('chat')}
                    className="flex-1 px-2 py-2 min-w-0"
                  >
                    <div className="font-medium truncate">{s.title || 'Conversa'}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(s.updated_at).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={() => setSessionToDelete(s.id)}
                    className="opacity-0 group-hover:opacity-100 hover:text-destructive p-2 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )
            })
          )}
        </div>

        <div className="p-3 border-t bg-card text-xs space-y-1">
          <div className="flex items-center gap-1.5">
            <div
              className={`w-2 h-2 rounded-full ${attendantEnabled ? 'bg-green-500' : 'bg-amber-500'}`}
            />
            <span className="text-muted-foreground">
              Atendente: <strong>{attendantEnabled ? 'Ativo' : 'Pausado'}</strong>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className={`w-2 h-2 rounded-full ${hasApiKey ? 'bg-green-500' : 'bg-red-500'}`}
            />
            <span className="text-muted-foreground">
              API Anthropic: <strong>{hasApiKey ? 'configurada' : 'pendente'}</strong>
            </span>
          </div>
        </div>
      </aside>

      {/* Chat area */}
      <main className={`flex-1 flex-col bg-background ${mobileView === 'chat' ? 'flex' : 'hidden'} md:flex`}>
        <header className="px-4 md:px-6 py-3 border-b flex items-center justify-between gap-2 bg-card">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setMobileView('list')}
              className="md:hidden shrink-0 -ml-1 p-1.5 rounded-md hover:bg-muted text-muted-foreground"
              aria-label="Abrir lista de conversas"
            >
              <PanelLeft className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <div className="font-medium text-sm">Agente IA — Testar</div>
              <div className="text-[11px] text-muted-foreground">
                Mensagens aqui NÃO enviam para WhatsApp e NÃO criam leads. É só pra testar a persona.
              </div>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px]">
            <Sparkles className="w-2.5 h-2.5 mr-1" /> Playground
          </Badge>
        </header>

        {!hasApiKey && (
          <div className="border-b border-amber-300 bg-amber-50 dark:bg-amber-900/20 px-6 py-3 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-amber-800 dark:text-amber-300">
              Cadastre a chave da Anthropic em{' '}
              <Link href={`/app/${orgSlug}/configuracoes/ia`} className="underline font-medium">
                Configurações → IA
              </Link>{' '}
              antes de testar.
            </span>
          </div>
        )}

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-sm text-muted-foreground space-y-2">
              <Bot className="w-10 h-10 opacity-30" />
              <p>Mande a primeira mensagem como se fosse um cliente.</p>
              <p className="text-xs">
                Ex: "Oi, vi um anúncio de vocês, queria saber preço."
              </p>
            </div>
          ) : (
            messages.map(m => (
              <div
                key={m.id}
                className={`flex gap-3 ${
                  m.role === 'user' ? 'flex-row-reverse' : ''
                } ${m.role === 'system' ? 'justify-center' : ''}`}
              >
                {m.role !== 'system' && (
                  <div
                    className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center ${
                      m.role === 'user'
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                        : 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                    }`}
                  >
                    {m.role === 'user' ? (
                      <UserIcon className="w-4 h-4" />
                    ) : (
                      <Bot className="w-4 h-4" />
                    )}
                  </div>
                )}
                <div
                  className={`max-w-[70%] ${
                    m.role === 'user' ? 'items-end' : ''
                  } ${m.role === 'system' ? 'max-w-full' : ''}`}
                >
                  {/* Tool calls (above the assistant text bubble, if any) */}
                  {m.role === 'assistant' && toolCallsByMessageId[m.id]?.length > 0 && (
                    <div className="mb-2 space-y-1.5">
                      {toolCallsByMessageId[m.id].map((tc, i) => (
                        <ToolCallCard key={i} call={tc} />
                      ))}
                    </div>
                  )}
                  <div
                    className={`rounded-none px-4 py-2.5 text-sm whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : m.role === 'system'
                          ? 'bg-destructive/10 text-destructive text-xs italic px-3 py-1.5'
                          : 'bg-muted'
                    }`}
                  >
                    {m.content}
                  </div>
                  {m.role === 'assistant' && (m.tokens_input || m.tokens_output) && (
                    <div className="text-[10px] text-muted-foreground mt-1 px-2 flex gap-2">
                      <span>
                        {m.tokens_input}→{m.tokens_output} tok
                      </span>
                      {(m.cache_read_tokens || 0) > 0 && (
                        <span className="text-green-600">cache: {m.cache_read_tokens}</span>
                      )}
                      <span>·</span>
                      <span>{fmtCostBRL(m.cost_cents)}</span>
                      {m.model && <span>· {m.model.replace('claude-', '')}</span>}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {sending && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-muted rounded-none px-4 py-2.5 text-sm flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="text-muted-foreground">pensando...</span>
              </div>
            </div>
          )}
        </div>

        <div className="border-t bg-card p-4">
          <form
            onSubmit={e => {
              e.preventDefault()
              send()
            }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Digite como se fosse um cliente..."
              disabled={sending || !activeSessionId}
              autoFocus
            />
            <Button type="submit" disabled={sending || !input.trim() || !activeSessionId}>
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </form>
        </div>
      </main>

      <AlertDialog open={!!sessionToDelete} onOpenChange={o => !o && setSessionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar conversa de teste?</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { deleteSession(sessionToDelete!); setSessionToDelete(null) }}
            >
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/**
 * Compact card showing what tool the AI invoked, its inputs and the textual
 * result. Collapsed by default — operator clicks to expand and inspect.
 */
function ToolCallCard({ call }: { call: ToolCallRecord }) {
  const [open, setOpen] = useState(false)
  const inputPreview =
    Object.entries(call.input || {})
      .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
      .join(' · ') || '(sem parâmetros)'
  return (
    <div className="border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-900/10 rounded-lg overflow-hidden text-xs">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-amber-100/60 dark:hover:bg-amber-900/20 transition-colors"
      >
        <Wrench className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-mono text-amber-800 dark:text-amber-200 truncate">
            {call.name}({inputPreview})
          </div>
        </div>
        {open ? (
          <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="px-3 pb-2 pt-1 border-t border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-900/5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            Resultado
          </div>
          <pre className="whitespace-pre-wrap font-mono text-[10px] text-foreground/80 leading-relaxed">
            {call.output}
          </pre>
        </div>
      )}
    </div>
  )
}
