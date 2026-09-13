'use client'

import { Handle, Position } from '@xyflow/react'
import { PlayCircle, FlagTriangleRight } from 'lucide-react'
import { getFieldTypeDef } from './FieldTypeMeta'
import { cn } from '@/lib/utils'

export type FormFlowNodeData = {
  label: string
  kind: 'welcome' | 'field' | 'ending'
  fieldType?: string
}

/** Node do canvas de fluxo — visual só (sem lógica de negócio aqui), usado
 *  tanto pro node de boas-vindas/fim quanto pra cada pergunta. */
export default function FormFlowNode({ data }: { data: FormFlowNodeData }) {
  const isTerminal = data.kind === 'welcome' || data.kind === 'ending'
  const typeDef = data.fieldType ? getFieldTypeDef(data.fieldType) : null
  const Icon = data.kind === 'welcome' ? PlayCircle : data.kind === 'ending' ? FlagTriangleRight : typeDef?.icon

  return (
    <div
      className={cn(
        'rounded-md border bg-card shadow-sm px-3 py-2 min-w-[180px] max-w-[220px]',
        isTerminal && 'border-dashed bg-muted/40',
      )}
    >
      {data.kind !== 'welcome' && <Handle type="target" position={Position.Top} className="!bg-muted-foreground" />}
      <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
        {Icon && <Icon className="w-3 h-3" />}
        {data.kind === 'welcome' ? 'Início' : data.kind === 'ending' ? 'Fim' : typeDef?.label}
      </div>
      <p className="text-xs font-medium mt-0.5 leading-snug line-clamp-2">{data.label}</p>
      {data.kind !== 'ending' && <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground" />}
    </div>
  )
}
