'use client'

import { BaseEdge, EdgeLabelRenderer, getBezierPath, useReactFlow, type EdgeProps } from '@xyflow/react'
import { X } from 'lucide-react'

/**
 * Edge com um botão "x" sempre visível no meio da linha, pra desconectar
 * sem precisar selecionar a conexão e abrir um painel — usado tanto no
 * canvas de fluxo de Formulários quanto no de Automações do Instagram.
 */
export default function DeletableEdge(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd, label } = props
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
  const { setEdges } = useReactFlow()

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      <EdgeLabelRenderer>
        <div
          style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          className="nodrag nopan flex items-center gap-1 pointer-events-auto"
        >
          {label ? <span className="text-[9px] bg-card border rounded px-1 leading-4 whitespace-nowrap">{label}</span> : null}
          <button
            type="button"
            title="Desconectar"
            onClick={e => { e.stopPropagation(); setEdges(es => es.filter(edge => edge.id !== id)) }}
            className="w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:opacity-80 shrink-0"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
