'use client'

/**
 * Message-list area for SandboxPlayground (empty state, message bubbles,
 * tool-call cards, sending indicator). Prop-driven, split out of
 * SandboxPlayground.tsx.
 */

import { useState } from 'react'
import { Bot, User as UserIcon, Loader2, Wrench, ChevronDown, ChevronUp } from 'lucide-react'

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

type ToolCallRecord = { name: string; input: Record<string, any>; output: string }

function fmtCostBRL(usdCents: number | null | undefined): string {
  if (!usdCents) return '—'
  // Quick USD→BRL conversion at ~R$5.0. For accurate FX, store/fetch a rate.
  const brl = (usdCents / 100) * 5.0
  if (brl < 0.01) return '< R$ 0,01'
  return `R$ ${brl.toFixed(4)}`
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

export function SandboxPlaygroundMessages({
  messages, toolCallsByMessageId, sending, scrollRef,
}: {
  messages: Message[]
  toolCallsByMessageId: Record<string, ToolCallRecord[]>
  sending: boolean
  scrollRef: React.RefObject<HTMLDivElement>
}) {
  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
      {messages.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-sm text-muted-foreground space-y-2">
          <Bot className="w-10 h-10 opacity-30" />
          <p>Mande a primeira mensagem como se fosse um cliente.</p>
          <p className="text-xs">
            Ex: &quot;Oi, vi um anúncio de vocês, queria saber preço.&quot;
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
  )
}
