'use client'

/**
 * Message-list area for CopilotDock's chat pane (empty state, suggested
 * prompts, message bubbles, tool-call cards, streaming indicator).
 * Prop-driven, split out of CopilotDock.tsx.
 */

import dynamic from 'next/dynamic'
import { Loader2, Pin } from 'lucide-react'
import { LogoMark } from '@/components/brand/Logo'

const AnalyticsViewCard = dynamic(() => import('@/components/features/ai/AnalyticsViewCard'), {
  ssr: false,
  loading: () => <div className="h-24 rounded-xl bg-muted animate-pulse" />,
})

type ToolCall = { name: string; input: Record<string, any>; result: { summary: string; view: any } }
type Message = { id: string; role: 'user' | 'assistant' | 'system'; content: string; tool_calls: ToolCall[] | null }

const SUGGESTED_PROMPTS = [
  'Onde estou perdendo mais leads no funil?',
  'Qual meu forecast de receita do mês?',
  'Resumo da semana',
]

// Tokeniza **negrito**, [rótulo](link) markdown, e URLs/caminhos crus
// (fallback caso a tool não tenha mascarado o link) numa única passada — a
// IA é instruída a sempre usar [rótulo](link) pra voucher/documento (nunca
// URL crua na resposta), mas o fallback evita link não-clicável se algum
// texto escapar sem o formato.
const TOKEN_PATTERN = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|https?:\/\/[^\s)]+|\/voucher-print\/[^\s)]+)/g
const MD_LINK_PATTERN = /^\[([^\]]+)\]\(([^)]+)\)$/
const BARE_LINK_PATTERN = /^(https?:\/\/[^\s)]+|\/voucher-print\/[^\s)]+)$/

function renderMarkdownLite(text: string): React.ReactNode {
  const parts = text.split(TOKEN_PATTERN)
  return parts.map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>
    const mdLink = MD_LINK_PATTERN.exec(part)
    if (mdLink) {
      return <a key={i} href={mdLink[2]} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2 hover:opacity-80">{mdLink[1]}</a>
    }
    if (BARE_LINK_PATTERN.test(part)) {
      return <a key={i} href={part} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2 hover:opacity-80">{part}</a>
    }
    return <span key={i}>{part}</span>
  })
}

export function CopilotDockMessages({
  enabled, messages, streaming, onSend, onPin, endRef,
}: {
  enabled: boolean
  messages: Message[]
  streaming: boolean
  onSend: (text: string) => void
  onPin: (title: string, view: any) => void
  endRef: React.RefObject<HTMLDivElement>
}) {
  return (
    <div className="max-w-[720px] mx-auto px-6 sm:px-8 py-8 space-y-7">
      {!enabled ? (
        <div className="text-sm text-muted-foreground text-center py-8">
          O copiloto não está disponível no seu plano.
        </div>
      ) : messages.length === 0 ? (
        <div className="pt-10 space-y-5">
          <div className="space-y-1.5">
            <LogoMark v2 className="h-11 w-11 rounded-2xl mb-3" />
            <h3 className="text-xl font-semibold tracking-tight">Como posso ajudar?</h3>
            <p className="text-sm text-muted-foreground">Pergunte algo sobre o seu negócio.</p>
          </div>
          <div className="grid gap-2">
            {SUGGESTED_PROMPTS.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => onSend(p)}
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
                        onClick={() => onPin(tc.name.replace('consultar_', ''), tc.result.view)}
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
  )
}
