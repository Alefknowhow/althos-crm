'use client'

import { Handle, Position } from '@xyflow/react'
import { Zap, FlagTriangleRight, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { stepMeta, TRIGGER_COLOR, type StepTypeMeta } from './AutomationFlowMeta'
import { triggerMeta } from '@/lib/automations/trigger-meta'

export type AutomationCanvasNodeData = {
  kind: 'trigger' | 'step' | 'end'
  /** trigger_type (kind='trigger') ou step.type (kind='step'). */
  typeId?: string
  label: string
  hasErrors?: boolean
}

type NodeExtraProps = {
  /** Injetados pelo canvas a cada render (não persistem em `data`, evita
   *  closures obsoletas — ver AutomationFlowCanvas.tsx). Ausentes no node
   *  'end' (não tem próximo passo). */
  onAddNext?: (type: string) => void
  addableStepTypes?: StepTypeMeta[]
}

/**
 * Node compacto do canvas de Automações — só ícone + tipo + um resumo de
 * uma linha. Configuração completa fica no painel do canto (ver
 * AutomationFlowNodeEditPanel), aberto ao clicar no node — mesmo padrão do
 * canvas de funil de Instagram (SocialFunnelNode.tsx).
 */
export default function AutomationFlowCanvasNode({ data, onAddNext, addableStepTypes }: { data: AutomationCanvasNodeData } & NodeExtraProps) {
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
        'relative rounded-md border bg-card shadow-sm px-3 py-2 min-w-[190px] max-w-[240px]',
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

      {/* Botão "+" pra adicionar o próximo passo direto a partir deste nó —
          mesmo resultado do botão "Adicionar passo" da barra superior, só
          que já conectado e posicionado a partir daqui. */}
      {!isEnd && onAddNext && addableStepTypes && addableStepTypes.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="nodrag absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-primary text-primary-foreground shadow flex items-center justify-center hover:scale-110 transition-transform"
              onClick={e => e.stopPropagation()}
              aria-label="Adicionar próximo passo"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 max-h-[60vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <DropdownMenuLabel className="text-xs">Adicionar passo</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {addableStepTypes.map(t => (
              <DropdownMenuItem key={t.id} onClick={() => onAddNext(t.id)}>
                <t.icon className="w-4 h-4 mr-2 shrink-0" style={{ color: t.color }} />
                <span className="text-sm">{t.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
