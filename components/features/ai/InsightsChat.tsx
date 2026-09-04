'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Sparkles, Send, AlertTriangle, Loader2, PanelLeft, X } from 'lucide-react'
import {
  sendInsightMessage,
  createInsightsSession,
  deleteInsightsSession,
} from '@/actions/ai_insights'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { InsightsChatSidebar } from './InsightsChatSidebar'
import { InsightsChatMessages } from './InsightsChatMessages'

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
    <div className="-mx-3 -my-5 sm:-mx-5 h-[calc(100dvh-3.5rem)] flex">
      {/* Session list */}
      <InsightsChatSidebar
        orgSlug={orgSlug}
        hasApiKey={hasApiKey}
        sessions={sessions}
        activeSessionId={activeSessionId}
        mobileView={mobileView}
        setMobileView={setMobileView}
        onNewSession={newSession}
        onDeleteSession={setSessionToDelete}
      />

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
              <Link href={`/app/${orgSlug}/configuracoes/agente-ia?tab=qualificacao`} className="underline font-medium">
                Configurações → Agente IA
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

        <InsightsChatMessages
          messages={messages}
          sending={sending}
          onSend={send}
          scrollRef={scrollRef}
        />

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
