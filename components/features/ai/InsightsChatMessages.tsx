'use client'

/**
 * Message-list area for InsightsChat (empty state, suggested prompts,
 * message bubbles, tool-call cards, streaming indicator). Prop-driven,
 * split out of InsightsChat.tsx.
 */

import dynamic from 'next/dynamic'
import { Sparkles, User as UserIcon, Loader2 } from 'lucide-react'

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

export function InsightsChatMessages({
  messages, sending, onSend, scrollRef,
}: {
  messages: Message[]
  sending: boolean
  onSend: (text?: string) => void
  scrollRef: React.RefObject<HTMLDivElement>
}) {
  return (
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
                onClick={() => onSend(p)}
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
                  className={`rounded-none px-4 py-2.5 text-sm whitespace-pre-wrap ${
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
          <div className="bg-muted rounded-none px-4 py-2.5 text-sm flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span className="text-muted-foreground">analisando seus dados...</span>
          </div>
        </div>
      )}
    </div>
  )
}
