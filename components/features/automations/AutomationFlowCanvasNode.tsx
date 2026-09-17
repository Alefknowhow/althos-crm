'use client'

import { Handle, Position } from '@xyflow/react'
import { Zap, FlagTriangleRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { stepMeta, TRIGGER_COLOR } from './AutomationFlowMeta'
import { triggerMeta } from '@/lib/automations/trigger-meta'

export type AutomationCanvasNodeData = {
  kind: 'trigger' | 'step' | 'end'
  /** trigger_type (kind='trigger') ou step.type (kind='step'). */
  typeId?: string
  label: string
  hasErrors?: boolean
}

/**
 * Node compacto do canvas de Automações — só ícone + tipo + um resumo de
 * uma linha. Configuração completa fica no painel do canto (ver
 * AutomationFlowNodeEditPanel), aberto ao clicar no node — mesmo padrão do
 * canvas de funil de Instagram (SocialFunnelNode.tsx).
 */
export default function AutomationFlowCanvasNode({ data }: { data: AutomationCanvasNodeData }) {
  const isEnd = data.kind === 'end'
  const meta = data.kind === 'trigger'
    ? { icon: Zap, color: TRIGGER_COLOR, label: triggerMeta(data.typeId || '').label }
    : data.kind === 'step'
      ? (() => { const m = stepMeta(data.typeId || ''); return { icon: m.icon, color: m.color, label: m.label } })()
      : { icon: FlagTriangleRight, color: '#94a3b8', label: 'Fim' }
  const Icon = meta.icon

  return (
    <div
      className={cn(
        'rounded-md border bg-card shadow-sm px-3 py-2 min-w-[190px] max-w-[240px]',
        isEnd && 'border-dashed bg-muted/40',
        data.hasErrors && 'border-destructive',
      )}
    >
      {data.kind !== 'trigger' && <Handle type="target" position={Position.Top} className="!bg-muted-foreground" />}

      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: meta.color }}>
        <Icon className="w-3 h-3 shrink-0" />
        <span className="truncate">{meta.label}</span>
      </div>
      {!isEnd && <p className="text-xs font-medium mt-0.5 leading-snug line-clamp-3">{data.label}</p>}

      {data.kind !== 'end' && (
        <Handle type="source" position={Position.Bottom} id="default" className="!bg-muted-foreground" />
      )}
    </div>
  )
}
