'use client'

import { Handle, Position } from '@xyflow/react'
import { PlayCircle, FlagTriangleRight } from 'lucide-react'
import { getFieldTypeDef } from './FieldTypeMeta'
import { cn } from '@/lib/utils'

export type FormFlowNodeData = {
  label: string
  kind: 'welcome' | 'field' | 'ending'
  fieldType?: string
  /** Opções da pergunta (single_choice/select/multi_select) — cada uma
   *  vira um handle de saída próprio, pra ligar direto "essa resposta" a
   *  um próximo passo sem precisar configurar a condição manualmente. */
  options?: string[]
}

const CHOICE_TYPES = new Set(['single_choice', 'select', 'multi_select'])

/** Node do canvas de fluxo — visual só (sem lógica de negócio aqui), usado
 *  tanto pro node de boas-vindas/fim quanto pra cada pergunta. */
export default function FormFlowNode({ data }: { data: FormFlowNodeData }) {
  const isTerminal = data.kind === 'welcome' || data.kind === 'ending'
  const typeDef = data.fieldType ? getFieldTypeDef(data.fieldType) : null
  const Icon = data.kind === 'welcome' ? PlayCircle : data.kind === 'ending' ? FlagTriangleRight : typeDef?.icon
  const isChoice = data.kind === 'field' && data.fieldType ? CHOICE_TYPES.has(data.fieldType) : false
  const options = isChoice ? (data.options || []) : []

  return (
    <div
      className={cn(
        'rounded-md border bg-card shadow-sm px-3 py-2 min-w-[190px] max-w-[230px]',
        isTerminal && 'border-dashed bg-muted/40',
      )}
    >
      {data.kind !== 'welcome' && <Handle type="target" position={Position.Top} className="!bg-muted-foreground" />}
      <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
        {Icon && <Icon className="w-3 h-3" />}
        {data.kind === 'welcome' ? 'Início' : data.kind === 'ending' ? 'Fim' : typeDef?.label}
      </div>
      <p className="text-xs font-medium mt-0.5 leading-snug line-clamp-2">{data.label}</p>

      {data.kind === 'field' && options.length > 0 && (
        <div className="mt-2 space-y-1">
          {options.map((opt, i) => (
            <div key={i} className="relative text-[10px] rounded border bg-muted/50 px-1.5 py-0.5 text-center truncate">
              {opt || `Opção ${i + 1}`}
              <Handle
                type="source"
                position={Position.Bottom}
                id={`opt-${i}`}
                style={{ left: `${((i + 1) / (options.length + 1)) * 100}%` }}
                className="!bg-primary"
              />
            </div>
          ))}
        </div>
      )}

      {data.kind !== 'ending' && (
        <Handle
          type="source"
          position={Position.Bottom}
          id="default"
          style={options.length > 0 ? { left: '8px' } : undefined}
          className="!bg-muted-foreground"
        />
      )}
    </div>
  )
}
