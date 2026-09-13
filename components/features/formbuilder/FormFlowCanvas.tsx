'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, addEdge,
  useNodesState, useEdgesState, type Node, type Edge, type Connection,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { FormSchema, FormField } from '../PublicFormSchema'
import type { FormFlow, FlowCondition, FlowEdge } from '@/lib/forms/flow-traversal'
import { getOrderedFields } from '@/lib/forms/field-order'
import FormFlowNode, { type FormFlowNodeData } from './FormFlowNode'
import FormFlowConditionPanel from './FormFlowConditionPanel'

const NODE_TYPES = { formFlow: FormFlowNode }
const NODE_GAP_Y = 130

/** Monta os nodes/edges iniciais do canvas: se `schema.flow` já existe,
 *  usa ele; senão semeia a cadeia linear atual (welcome → campo 0 → ... →
 *  ending) — o canvas nasce mostrando o comportamento de hoje como grafo,
 *  não em branco. */
function buildInitialGraph(schema: FormSchema): { nodes: Node<FormFlowNodeData>[]; edges: Edge[] } {
  const orderedFields = getOrderedFields(schema.fields)
  const showWelcome = !!schema.welcome?.enabled
  const chain: string[] = [...(showWelcome ? ['welcome'] : []), ...orderedFields.map(f => f.id), 'ending']

  const positions = schema.flow?.positions || {}
  const nodes: Node<FormFlowNodeData>[] = chain.map((id, i) => {
    const field = orderedFields.find(f => f.id === id)
    const kind: FormFlowNodeData['kind'] = id === 'welcome' ? 'welcome' : id === 'ending' ? 'ending' : 'field'
    return {
      id,
      type: 'formFlow',
      position: positions[id] || { x: 40, y: i * NODE_GAP_Y },
      data: {
        label: kind === 'welcome' ? 'Início' : kind === 'ending' ? 'Fim do formulário' : field?.label || id,
        kind,
        fieldType: field?.type,
      },
    }
  })

  const savedEdges = schema.flow?.edges
  const sourceEdges: FlowEdge[] = savedEdges && savedEdges.length > 0 ? savedEdges : chain.slice(0, -1).map((id, i) => ({
    id: `${id}->${chain[i + 1]}`,
    from: id,
    to: chain[i + 1],
  }))
  const edges: Edge[] = sourceEdges.map(e => ({
    id: e.id,
    source: e.from,
    target: e.to,
    animated: !e.condition,
    label: e.condition ? 'condição' : undefined,
    data: { condition: e.condition },
  }))

  return { nodes, edges }
}

type Props = {
  schema: FormSchema
  onChangeFlow: (flow: FormFlow) => void
  onClose: () => void
}

/** Wrapper público — provê o contexto do React Flow, pra quem usa este
 *  componente não precisar saber disso. */
export default function FormFlowCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <FormFlowCanvasInner {...props} />
    </ReactFlowProvider>
  )
}

function FormFlowCanvasInner({ schema, onChangeFlow, onClose }: Props) {
  // Estado inicial derivado do schema UMA vez (na abertura) — depois disso
  // o canvas é a fonte da verdade; não re-deriva a cada re-render do pai
  // (evitaria perder posição/seleção a cada tecla digitada em outro lugar
  // do editor).
  const initial = useMemo(() => buildInitialGraph(schema), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [nodes, , onNodesChange] = useNodesState(initial.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)

  const fieldsById = useMemo(() => {
    const map = new Map<string, FormField>()
    for (const f of schema.fields || []) map.set(f.id, f)
    return map
  }, [schema.fields])

  // Propaga nodes/edges do canvas pro schema do formulário sempre que
  // mudam — não tem "salvar" próprio, entra junto no botão "Salvar" do
  // FormBuilder. onChangeFlow em ref pra não disparar o efeito por causa
  // de uma nova identidade de função a cada render do pai.
  const onChangeFlowRef = useRef(onChangeFlow)
  onChangeFlowRef.current = onChangeFlow
  useEffect(() => {
    const positions: Record<string, { x: number; y: number }> = {}
    for (const n of nodes) positions[n.id] = n.position
    onChangeFlowRef.current({
      positions,
      edges: edges.map(e => ({
        id: e.id,
        from: e.source,
        to: e.target,
        condition: (e.data as any)?.condition as FlowCondition | undefined,
      })),
    })
  }, [nodes, edges])

  const onConnect = useCallback((connection: Connection) => {
    setEdges(curr => addEdge({ ...connection, animated: true, data: { condition: undefined } }, curr))
  }, [setEdges])

  const selectedEdge = edges.find(e => e.id === selectedEdgeId) || null
  const selectedSourceField = selectedEdge && selectedEdge.source !== 'welcome' ? fieldsById.get(selectedEdge.source) || null : null

  function updateSelectedCondition(condition: FlowCondition | undefined) {
    setEdges(curr => curr.map(e => e.id === selectedEdgeId
      ? { ...e, data: { condition }, animated: !condition, label: condition ? 'condição' : undefined }
      : e))
  }

  function removeSelectedEdge() {
    setEdges(curr => curr.filter(e => e.id !== selectedEdgeId))
    setSelectedEdgeId(null)
  }

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="flex items-center justify-between px-4 py-2.5 border-b shrink-0">
        <div>
          <p className="text-sm font-semibold">Fluxo condicional</p>
          <p className="text-xs text-muted-foreground">Arraste de um node pra outro pra criar uma conexão. Clique numa conexão pra definir uma condição.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}><X className="w-4 h-4 mr-1" /> Fechar</Button>
      </div>

      <div className="relative flex-1 min-h-0">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgeClick={(_, edge) => setSelectedEdgeId(edge.id)}
          onPaneClick={() => setSelectedEdgeId(null)}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap pannable zoomable className="!bg-card" />
        </ReactFlow>

        {selectedEdge && (
          <FormFlowConditionPanel
            sourceField={selectedSourceField}
            condition={(selectedEdge.data as any)?.condition}
            onChange={updateSelectedCondition}
            onRemoveEdge={removeSelectedEdge}
            onClose={() => setSelectedEdgeId(null)}
          />
        )}
      </div>
    </div>
  )
}
