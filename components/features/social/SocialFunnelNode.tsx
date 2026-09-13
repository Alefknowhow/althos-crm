'use client'

import { Handle, Position } from '@xyflow/react'
import { PlayCircle, FlagTriangleRight, MessageSquare, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SocialFunnelNodeData = {
  label: string
  kind: 'trigger' | 'step' | 'end'
  stepType?: 'message' | 'ai'
  waitForReply?: boolean
  /** Rótulos dos botões do passo (até 3) — cada um vira um handle de saída
   *  próprio (btn-0, btn-1, btn-2), pra puxar uma conexão direto do botão
   *  específico e já fixar a condição (ver SocialFunnelCanvas.tsx). */
  buttonLabels?: string[]
}

/** Node do canvas de fluxo de DM — um passo com N botões mostra N handles
 *  de saída nomeados, além do handle "resposta livre"/padrão. */
export default function SocialFunnelNode({ data }: { data: SocialFunnelNodeData }) {
  const isTerminal = data.kind === 'trigger' || data.kind === 'end'
  const Icon = data.kind === 'trigger' ? PlayCircle : data.kind === 'end' ? FlagTriangleRight
    : data.stepType === 'ai' ? Sparkles : MessageSquare
  const buttonLabels = data.buttonLabels || []

  return (
    <div
      className={cn(
        'rounded-md border bg-card shadow-sm px-3 py-2 min-w-[190px] max-w-[230px]',
        isTerminal && 'border-dashed bg-muted/40',
      )}
    >
      {data.kind !== 'trigger' && <Handle type="target" position={Position.Top} className="!bg-muted-foreground" />}
      <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
        <Icon className="w-3 h-3" />
        {data.kind === 'trigger' ? 'Gatilho' : data.kind === 'end' ? 'Fim' : data.stepType === 'ai' ? 'IA' : 'Mensagem'}
      </div>
      <p className="text-xs font-medium mt-0.5 leading-snug line-clamp-3">{data.label}</p>

      {data.kind === 'step' && buttonLabels.length > 0 && (
        <div className="mt-2 space-y-1">
          {buttonLabels.map((label, i) => (
            <div key={i} className="relative text-[10px] rounded border bg-muted/50 px-1.5 py-0.5 text-center truncate">
              {label || `Botão ${i + 1}`}
              <Handle
                type="source"
                position={Position.Bottom}
                id={`btn-${i}`}
                style={{ left: `${((i + 1) / (buttonLabels.length + 1)) * 100}%` }}
                className="!bg-primary"
              />
            </div>
          ))}
        </div>
      )}

      {(data.kind === 'step' || data.kind === 'trigger') && (
        <Handle
          type="source"
          position={Position.Bottom}
          id="default"
          style={buttonLabels.length > 0 ? { left: '8px' } : undefined}
          className="!bg-muted-foreground"
        />
      )}
    </div>
  )
}
