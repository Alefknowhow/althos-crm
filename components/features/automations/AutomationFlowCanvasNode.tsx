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
  /** Só pra 'send_instagram_dm' — texto da mensagem (fixa ou instruções da
   *  IA) e botões, expostos direto no node em vez de escondidos no painel. */
  message?: string
  buttons?: { label: string; value: string }[]
}

type NodeExtraProps = {
  /** Injetados pelo canvas a cada render (não persistem em `data`, evita
   *  closures obsoletas — ver AutomationFlowCanvas.tsx). Ausentes no node
   *  'end' (não tem próximo passo). */
  onAddNext?: (type: string) => void
  addableStepTypes?: StepTypeMeta[]
}

/**
 * Node compacto do canvas de Automações — ícone + tipo + resumo de uma
 * linha (configuração completa fica no painel do canto, ver
 * AutomationFlowNodeEditPanel). Exceção: "DM do Instagram" expõe a
 * mensagem e os botões direto no node, cada botão com seu próprio ponto de
 * ligação (handle) — arrastar dali já fixa a condição de ramificação
 * (qual botão foi clicado), sem precisar abrir painel nenhum. Mesmo
 * princípio do node de funil de Instagram (SocialFunnelNode.tsx).
 */
export default function AutomationFlowCanvasNode({ data, selected, onAddNext, addableStepTypes }: { data: AutomationCanvasNodeData; selected?: boolean } & NodeExtraProps) {
  const isEnd = data.kind === 'end'
  const isInstagramDm = data.kind === 'step' && data.typeId === 'send_instagram_dm'
  const buttons = isInstagramDm ? (data.buttons || []) : []
  const meta = data.kind === 'trigger'
    ? { icon: Zap, color: TRIGGER_COLOR, label: triggerMeta(data.typeId || '').label }
    : data.kind === 'step'
      ? (() => { const m = stepMeta(data.typeId || ''); return { icon: m.icon, color: m.color, label: m.label } })()
      : { icon: FlagTriangleRight, color: '#94a3b8', label: 'Fim' }
  const Icon = meta.icon

  return (
    <div
      className={cn(
        'relative rounded-md border bg-card shadow-sm px-3 py-2 min-w-[190px] max-w-[260px] transition-shadow',
        isEnd && 'border-dashed bg-muted/40',
        data.hasErrors && 'border-destructive',
        selected && 'border-primary ring-2 ring-primary/40',
      )}
    >
      {data.kind !== 'trigger' && <Handle type="target" position={Position.Top} className="!bg-muted-foreground" />}

      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: meta.color }}>
        <Icon className="w-3 h-3 shrink-0" />
        <span className="truncate">{meta.label}</span>
      </div>

      {isInstagramDm ? (
        <>
          <p className="text-xs font-medium mt-0.5 leading-snug line-clamp-4 whitespace-pre-wrap">
            {data.message || 'Sem mensagem configurada'}
          </p>
          {buttons.length > 0 && (
            <div className="mt-2 space-y-1">
              {buttons.map((b, i) => (
                <div key={i} className="relative text-[10px] rounded border bg-muted/50 px-1.5 py-1 pr-4 truncate">
                  {b.label || `Botão ${i + 1}`}
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={`btn-${i}`}
                    className="!bg-primary"
                  />
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        !isEnd && <p className="text-xs font-medium mt-0.5 leading-snug line-clamp-3">{data.label}</p>
      )}

      {/* Sem botões: um único handle de saída padrão embaixo do node. Com
          botões, o ponto de ligação de cada um vive dentro da própria
          linha do botão (acima) — nada aqui embaixo. */}
      {data.kind !== 'end' && buttons.length === 0 && (
        <Handle type="source" position={Position.Bottom} id="default" className="!bg-muted-foreground" />
      )}

      {/* Botão "+" pra adicionar o próximo passo direto a partir deste nó —
          mesmo resultado do botão "Adicionar passo" da barra superior, só
          que já conectado e posicionado a partir daqui. Some quando o node
          tem botões (ramificação por handle própria, sem "próximo" único). */}
      {!isEnd && buttons.length === 0 && onAddNext && addableStepTypes && addableStepTypes.length > 0 && (
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
