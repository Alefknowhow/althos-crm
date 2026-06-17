'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Sparkles,
  Send,
  Plus,
  Trash2,
  User as UserIcon,
  AlertTriangle,
  Loader2,
  PanelLeft,
  X,
} from 'lucide-react'
import {
  sendInsightMessage,
  createInsightsSession,
  deleteInsightsSession,
} from '@/actions/ai_insights'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// recharts uses browser APIs during module initialisation — loading it
// server-side causes a hydration crash. Use dynamic with ssr:false so the
// chart card is only mounted in the browser.
const AnalyticsViewCard = dynamic(() => import('./AnalyticsViewCard'), {
  ssr: false,
  loading: () => <div className="h-32 rounded-lg bg-muted animate-pulse" />,
})

type ToolCall = {
  name: string
  input: Record<string, any>
  result: {
    summary: string
    view: any
  }
}

type Message = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  tool_calls: ToolCall[] | null
  tokens_input: number | null
  tokens_output: number | null
  cache_read_tokens: number | null
  cost_cents: number | null
  model: string | null
  created_at: string
}

type Session = {
  id: string
  title: string | null
  created_at: string
  updated_at: string
}

type Props = {
  orgSlug: string
  hasApiKey: boolean
  sessions: Session[]
  activeSessionId: string
  initialMessages: Message[]
}

const SUGGESTED_PROMPTS = [
  'Como está o negócio nos últimos 30 dias?',
  'Quais campanhas estão dando mais retorno?',
  'Mostre meus leads mais quentes agora',
  'Como está meu funil de vendas?',
  'Comparativo de vendas: este mês vs mês passado',
  'Quantos agendamentos tenho essa semana?',
]

function fmtCostBRL(usdCents: number | null | undefined): string {
  if (!usdCents) return '—'
  const brl = (usdCents / 100) * 5.0
  if (brl < 0.01) return '< R$ 0,01'
  return `R$ ${brl.toFixed(3)}`
}

/** Render a message body with very light markdown (bold + line breaks). */
function renderMarkdownLite(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    return <span key={i}>{part}</span>
  })
}

export default function InsightsChat({
  orgSlug,
  hasApiKey,
  sessions,
  activeSessionId,
  initialMessages,
}: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [messages, setMessages] = useState(initialMessages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null)
  // Mobile: one pane at a time. 'chat' is the default (a session is always
  // active); the user opens the session list with the header button.
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('chat')
  // Aviso "configure a chave" pode ser dispensado pelo usuário.
  const [noticeDismissed, setNoticeDismissed] = useState(false)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, sending])

  async function send(text?: string) {
    const userText = (text ?? input).trim()
    if (!userText || sending || !activeSessionId) return
    if (!hasApiKey) {
      toast.error('Cadastre a chave da Anthropic em Configurações → IA antes de usar.')
      return
    }
    setInput('')
    setSending(true)

    const optimisticId = `tmp-${Date.now()}`
    setMessages(prev => [
      ...prev,
      {
        id: optimisticId,
        role: 'user',
        content: userText,
        tool_calls: null,
        tokens_input: null,
        tokens_output: null,
        cache_read_tokens: null,
        cost_cents: null,
        model: null,
        created_at: new Date().toISOString(),
      },
    ])

    const res = await sendInsightMessage(orgSlug, activeSessionId, userText)
    setSending(false)

    if (!res.ok) {
      toast.error(res.error || 'Erro')
      router.refresh()
      return
    }

    if (res.assistantMessage) {
      setMessages(prev => [...prev, res.assistantMessage as Message])
    }
  }

  async function newSession() {
    const res = await createInsightsSession(orgSlug)
    if (res.ok) {
      startTransition(() => router.push(`/app/${orgSlug}/insights?session=${res.sessionId}`))
    } else {
      toast.error(res.error || 'Erro')
    }
  }

  async function deleteSession(sessionId: string) {
    const res = await deleteInsightsSession(orgSlug, sessionId)
    if (res.ok) {
      toast.success('Removida')
      if (sessionId === activeSessionId) {
        startTransition(() => router.push(`/app/${orgSlug}/insights`))
      } else {
        router.refresh()
      }
    } else {
      toast.error(res.error || 'Erro')
    }
  }

  return (
    <>
    <div className="-m-6 h-[calc(100vh-4rem)] flex">
      {/* Session list */}
      <aside className={`w-full md:w-72 border-r bg-muted/20 flex-col ${mobileView === 'list' ? 'flex' : 'hidden'} md:flex`}>
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm">Insights IA</h2>
            <button
              type="button"
              onClick={() => setMobileView('chat')}
              className="md:hidden ml-auto p-1 rounded-md hover:bg-muted text-muted-foreground"
              aria-label="Fechar lista"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Pergunte qualquer coisa sobre seus dados.
          </p>
          <Button size="sm" className="w-full" onClick={newSession}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Nova conversa
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Sem conversas ainda.</p>
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
                    href={`/app/${orgSlug}/insights?session=${s.id}`}
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
            <div className={`w-2 h-2 rounded-full ${hasApiKey ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-muted-foreground">
              API Anthropic: <strong>{hasApiKey ? 'configurada' : 'pendente'}</strong>
            </span>
          </div>
        </div>
      </aside>

      {/* Chat */}
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
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="font-medium text-sm">Analista IA</div>
              <div className="hidden sm:block text-[11px] text-muted-foreground">
                Pergunte sobre vendas, leads, campanhas, agendamentos. Eu consulto seus dados em tempo real.
              </div>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] shrink-0">
            <Sparkles className="w-2.5 h-2.5 mr-1" /> Beta
          </Badge>
        </header>

        {!hasApiKey && !noticeDismissed && (
          <div className="border-b border-amber-300 bg-amber-50 dark:bg-amber-900/20 px-4 sm:px-6 py-2.5 text-[13px] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-amber-800 dark:text-amber-300 min-w-0">
              Cadastre a chave da Anthropic em{' '}
              <Link href={`/app/${orgSlug}/configuracoes/ia`} className="underline font-medium">
                Configurações → IA
              </Link>{' '}
              antes de usar.
            </span>
            <button
              type="button"
              onClick={() => setNoticeDismissed(true)}
              className="ml-auto shrink-0 p-1 rounded-md text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/40"
              aria-label="Ocultar aviso"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 sm:py-6 space-y-5 sm:space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-xl mx-auto space-y-5 sm:space-y-6">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                  O que você quer saber sobre o negócio hoje?
                </h1>
                <p className="text-[13px] sm:text-sm text-muted-foreground mt-2">
                  Eu acesso todos os seus dados do CRM em tempo real — vendas, leads, campanhas,
                  agendamentos, pipeline. Pergunte em português natural.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 w-full">
                {SUGGESTED_PROMPTS.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => send(p)}
                    className="text-left text-[13px] sm:text-xs border rounded-lg px-3 py-2.5 hover:bg-muted hover:border-primary/40 transition-all"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map(m => (
              <div
                key={m.id}
                className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''} ${
                  m.role === 'system' ? 'justify-center' : ''
                }`}
              >
                {m.role !== 'system' && (
                  <div
                    className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center ${
                      m.role === 'user'
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                        : 'bg-primary/10 text-primary'
                    }`}
                  >
                    {m.role === 'user' ? (
                      <UserIcon className="w-4 h-4" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                  </div>
                )}
                <div
                  className={`${
                    m.role === 'user' ? 'max-w-[70%]' : 'max-w-[85%] flex-1'
                  } ${m.role === 'system' ? 'max-w-full' : ''} space-y-3`}
                >
                  {/* Tool result cards (render BEFORE the text reply, so user
                      sees the data first, then the AI's interpretation) */}
                  {m.role === 'assistant' &&
                    m.tool_calls &&
                    m.tool_calls.length > 0 &&
                    m.tool_calls.map((tc, i) => (
                      <AnalyticsViewCard key={i} view={tc.result.view} label={tc.name} />
                    ))}

                  {/* Text reply bubble */}
                  {m.content && (
                    <div
                      className={`rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                        m.role === 'user'
                          ? 'bg-primary text-primary-foreground inline-block'
                          : m.role === 'system'
                            ? 'bg-destructive/10 text-destructive text-xs italic px-3 py-1.5'
                            : 'bg-muted'
                      }`}
                    >
                      {renderMarkdownLite(m.content)}
                    </div>
                  )}

                  {m.role === 'assistant' && (m.tokens_input || m.tokens_output) && (
                    <div className="text-[10px] text-muted-foreground px-2 flex gap-2">
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
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="bg-muted rounded-2xl px-4 py-2.5 text-sm flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="text-muted-foreground">analisando seus dados...</span>
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
            className="flex gap-2 max-w-3xl mx-auto"
          >
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Pergunte sobre vendas, leads, campanhas, agenda..."
              disabled={sending || !activeSessionId}
              autoFocus
            />
            <Button type="submit" disabled={sending || !input.trim() || !activeSessionId}>
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </form>
        </div>
      </main>
    </div>

      <AlertDialog open={!!sessionToDelete} onOpenChange={o => !o && setSessionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar conversa?</AlertDialogTitle>
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
    </>
  )
}
