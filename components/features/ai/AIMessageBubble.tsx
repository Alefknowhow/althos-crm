'use client'

/**
 * Bubble de mensagem padrão de todos os chats de IA (issue #68, estilo
 * ChatGPT): usuário em bubble discreto à direita, resposta da IA integrada
 * ao fundo do chat (sem bubble), com slot pra tool-calls/cards acima do
 * texto. Extraído de CopilotDockMessages.tsx / ProjectCopilotPanel.tsx.
 */

import { Loader2 } from 'lucide-react'
import { renderMarkdownLite } from './markdownLite'

export function AIMessageBubble({
  role,
  content,
  pending,
  toolCalls,
}: {
  role: 'user' | 'assistant' | 'system'
  content: string
  /** true quando a mensagem ainda está sendo streamada e não tem texto — mostra indicador de "pensando". */
  pending?: boolean
  /** cards de tool-call/ação, renderizados acima do texto da resposta. */
  toolCalls?: React.ReactNode
}) {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-3xl rounded-br-lg bg-primary text-primary-foreground px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap">
          {content}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {toolCalls}
      {content ? (
        <div className="text-[15px] leading-7 text-foreground whitespace-pre-wrap">
          {renderMarkdownLite(content)}
        </div>
      ) : pending ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">pensando...</span>
        </div>
      ) : null}
    </div>
  )
}
