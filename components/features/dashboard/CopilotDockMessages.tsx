'use client'

/**
 * Message-list area for CopilotDock's chat pane (empty state, suggested
 * prompts, message bubbles, tool-call cards, streaming indicator).
 * Prop-driven, split out of CopilotDock.tsx.
 */

import dynamic from 'next/dynamic'
import { Pin } from 'lucide-react'
import { LogoMark } from '@/components/brand/Logo'
import { AIEmptyState } from '@/components/features/ai/AIEmptyState'
import { AIMessageBubble } from '@/components/features/ai/AIMessageBubble'
import { stripMarkdownTables } from '@/components/features/ai/markdownLite'

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
        <AIEmptyState
          icon={<LogoMark v2 className="h-11 w-11 rounded-2xl mb-3" />}
          description="Pergunte algo sobre o seu negócio."
          suggestions={SUGGESTED_PROMPTS}
          onSelectSuggestion={onSend}
        />
      ) : (
        messages.map(m => {
          const hasDataCard = !!m.tool_calls?.some(tc => tc.result?.view?.type !== 'none')
          return (
          <AIMessageBubble
            key={m.id}
            role={m.role}
            content={hasDataCard ? stripMarkdownTables(m.content) : m.content}
            pending={streaming}
            toolCalls={m.tool_calls && m.tool_calls.length > 0 ? m.tool_calls.map((tc, i) => (
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
            )) : undefined}
          />
          )
        })
      )}
      <div ref={endRef} />
    </div>
  )
}
