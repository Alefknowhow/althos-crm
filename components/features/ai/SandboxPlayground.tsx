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
  Sparkles,
  AlertTriangle,
  Loader2,
  PanelLeft,
} from 'lucide-react'
import {
  sendSandboxMessage,
  createSandboxSession,
  deleteSandboxSession,
} from '@/actions/ai_attendant'
import { SandboxPlaygroundSidebar } from './SandboxPlaygroundSidebar'
import { SandboxPlaygroundMessages } from './SandboxPlaygroundMessages'

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
      <SandboxPlaygroundSidebar
        orgSlug={orgSlug}
        attendantEnabled={attendantEnabled}
        hasApiKey={hasApiKey}
        sessions={sessions}
        activeSessionId={activeSessionId}
        mobileView={mobileView}
        setMobileView={setMobileView}
        onNewSession={newSession}
        onDeleteSession={setSessionToDelete}
      />

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
              <Link href={`/app/${orgSlug}/configuracoes/agente-ia?tab=qualificacao`} className="underline font-medium">
                Configurações → Agente IA
              </Link>{' '}
              antes de testar.
            </span>
          </div>
        )}

        <SandboxPlaygroundMessages
          messages={messages}
          toolCallsByMessageId={toolCallsByMessageId}
          sending={sending}
          scrollRef={scrollRef}
        />

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
