'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, addEdge,
  useNodesState, useEdgesState, type Node, type Edge, type Connection,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { FunnelStep } from '@/actions/social-funnels'
import type { FunnelFlow, FunnelEdgeCondition } from '@/lib/social/funnel-traversal'
import { TRIGGER_TYPE_LABELS, type FunnelTriggerType } from '@/lib/social/trigger-types'
import SocialFunnelNode, { type SocialFunnelNodeData } from './SocialFunnelNode'
import SocialFunnelEdgePanel from './SocialFunnelEdgePanel'
import SocialFunnelNodeEditPanel from './SocialFunnelNodeEditPanel'
import DeletableEdge from '../flow/DeletableEdge'

const NODE_TYPES = { socialFunnel: SocialFunnelNode }
const EDGE_TYPES = { default: DeletableEdge }
const NODE_GAP_Y = 150

/** Id estável de um passo pro grafo — mesma regra de lib/social/funnel-engine.ts::stepGraphId. */
function stepGraphId(step: FunnelStep, index: number): string {
  return step.client_id || `idx-${index}`
}

function buildInitialGraph(
  steps: FunnelStep[], triggerType: FunnelTriggerType, flow: FunnelFlow | undefined,
): { nodes: Node<SocialFunnelNodeData>[]; edges: Edge[] } {
  const ids = steps.map((s, i) => stepGraphId(s, i))
  const chain = ['trigger', ...ids, 'end']
  const positions = flow?.positions || {}

  const nodes: Node<SocialFunnelNodeData>[] = chain.map((id, i) => {
    const stepIndex = ids.indexOf(id)
    const step = stepIndex >= 0 ? steps[stepIndex] : null
    const kind: SocialFunnelNodeData['kind'] = id === 'trigger' ? 'trigger' : id === 'end' ? 'end' : 'step'
    const label = kind === 'trigger'
      ? TRIGGER_TYPE_LABELS[triggerType]
      : kind === 'end' ? 'Fim da automação'
      : (step?.step_type === 'ai' ? (step.ai_instructions || 'Resposta por IA') : (step?.message_text || 'Mensagem'))
    return {
      id,
      type: 'socialFunnel',
      position: positions[id] || { x: 40, y: i * NODE_GAP_Y },
      data: {
        label,
        kind,
        stepType: step?.step_type,
        waitForReply: step?.wait_for_reply,
        buttonLabels: step?.buttons?.map(b => b.label),
      },
    }
  })

  const savedEdges = flow?.edges
  const sourceEdges = savedEdges && savedEdges.length > 0 ? savedEdges : chain.slice(0, -1).map((id, i) => ({
    id: `${id}->${chain[i + 1]}`,
    from: id,
    to: chain[i + 1],
  }))
  const edges: Edge[] = sourceEdges.map(e => {
    const condition = (e as any).condition as FunnelEdgeCondition | undefined
    const sourceHandle = condition?.type === 'button' ? `btn-${condition.buttonIndex}` : 'default'
    return {
      id: e.id,
      source: e.from,
      target: e.to,
      sourceHandle,
      animated: !condition,
      label: condition?.type === 'keyword' ? 'palavra-chave' : undefined,
      data: { condition },
    }
  })

  return { nodes, edges }
}

type Props = {
  steps: FunnelStep[]
  triggerType: FunnelTriggerType
  flow: FunnelFlow | undefined
  onChangeFlow: (flow: FunnelFlow) => void
  onUpdateStep: (clientId: string, patch: Partial<FunnelStep>) => void
  /** Cria um novo passo (na lista, fonte de verdade) e devolve seu client_id
   *  — o canvas usa o id pra desenhar o node novo direto no fluxo. */
  onAddStep: (type: 'message' | 'ai') => string
  onClose: () => void
}

/** Wrapper público — provê o contexto do React Flow. */
export default function SocialFunnelCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <SocialFunnelCanvasInner {...props} />
    </ReactFlowProvider>
  )
}

function SocialFunnelCanvasInner({ steps, triggerType, flow, onChangeFlow, onUpdateStep, onAddStep, onClose }: Props) {
  // Estado inicial derivado UMA vez na abertura — depois disso o canvas é
  // a fonte da verdade (mesmo padrão de FormFlowCanvas.tsx).
  const initial = useMemo(() => buildInitialGraph(steps, triggerType, flow), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  const stepsById = useMemo(() => {
    const map = new Map<string, FunnelStep>()
    steps.forEach((s, i) => map.set(stepGraphId(s, i), s))
    return map
  }, [steps])

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
        condition: (e.data as any)?.condition as FunnelEdgeCondition | undefined,
      })),
    })
  }, [nodes, edges])

  function onConnect(connection: Connection) {
    // Conexão saindo de um botão já fixa a condição — não precisa de
    // painel manual, o handle já diz qual botão é.
    const btnMatch = connection.sourceHandle?.match(/^btn-(\d+)$/)
    const condition: FunnelEdgeCondition | undefined = btnMatch
      ? { type: 'button', buttonIndex: Number(btnMatch[1]) }
      : undefined
    setEdges(curr => addEdge({ ...connection, animated: !condition, data: { condition } }, curr))
  }

  const selectedEdge = edges.find(e => e.id === selectedEdgeId) || null
  const selectedEdgeCondition = (selectedEdge?.data as any)?.condition as FunnelEdgeCondition | undefined
  const selectedButtonLabel = selectedEdgeCondition?.type === 'button'
    ? nodes.find(n => n.id === selectedEdge?.source)?.data.buttonLabels?.[selectedEdgeCondition.buttonIndex]
    : undefined

  function updateSelectedCondition(condition: FunnelEdgeCondition | undefined) {
    setEdges(curr => curr.map(e => e.id === selectedEdgeId
      ? { ...e, data: { condition }, animated: !condition, label: condition?.type === 'keyword' ? 'palavra-chave' : undefined }
      : e))
  }

  function removeSelectedEdge() {
    setEdges(curr => curr.filter(e => e.id !== selectedEdgeId))
    setSelectedEdgeId(null)
  }

  const selectedNode = nodes.find(n => n.id === selectedNodeId) || null
  const selectedNodeStep = selectedNode && selectedNode.data.kind === 'step' ? stepsById.get(selectedNode.id) || null : null

  function updateSelectedStep(patch: Partial<FunnelStep>) {
    if (!selectedNodeId || !selectedNodeStep) return
    onUpdateStep(selectedNodeId, patch)
    // Reflete no node local (tipo/label/botões) sem esperar o array de steps
    // do pai voltar como prop — mescla o patch no step atual pra derivar o
    // label/handles do mesmo jeito que buildInitialGraph faz. buttonLabels
    // precisa ser atualizado aqui também: é o que desenha os handles de
    // saída por botão no node (SocialFunnelNode.tsx) — sem isso, editar os
    // botões pelo painel do canvas não mostraria os handles novos até
    // fechar e reabrir o fluxo.
    const merged = { ...selectedNodeStep, ...patch }
    const label = merged.step_type === 'ai' ? (merged.ai_instructions || 'Resposta por IA') : (merged.message_text || 'Mensagem')
    setNodes(curr => curr.map(n => n.id === selectedNodeId
      ? { ...n, data: { ...n.data, stepType: merged.step_type, label, buttonLabels: merged.buttons?.map(b => b.label) } }
      : n))
  }

  /** "+ Adicionar passo" no canvas: cria o passo na lista (fonte de
   *  verdade, via onAddStep) e desenha o node correspondente aqui — ligado
   *  por uma edge ao node selecionado, se houver um. */
  function handleAddStep() {
    const clientId = onAddStep('message')
    const basePos = selectedNode?.position ?? { x: 40, y: Math.max(0, ...nodes.map(n => n.position.y)) + NODE_GAP_Y }
    const newPos = { x: basePos.x + 260, y: basePos.y }
    setNodes(curr => [...curr, {
      id: clientId,
      type: 'socialFunnel',
      position: newPos,
      data: { label: 'Mensagem', kind: 'step', stepType: 'message', waitForReply: true, buttonLabels: [] },
    }])
    if (selectedNodeId) {
      setEdges(curr => addEdge({ id: `${selectedNodeId}->${clientId}`, source: selectedNodeId, target: clientId, animated: true }, curr))
    }
    setSelectedNodeId(clientId)
    setSelectedEdgeId(null)
  }

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="flex items-center justify-between px-4 py-2.5 border-b shrink-0">
        <div>
          <p className="text-sm font-semibold">Fluxo da automação</p>
          <p className="text-xs text-muted-foreground">Clique num passo pra editar a resposta. Arraste a partir de um botão pra ramificar. Clique no "x" da conexão pra desconectar.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleAddStep}><Plus className="w-4 h-4 mr-1" /> Adicionar passo</Button>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="w-4 h-4 mr-1" /> Fechar</Button>
        </div>
      </div>

      <div className="relative flex-1 min-h-0">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgeClick={(_, edge) => { setSelectedEdgeId(edge.id); setSelectedNodeId(null) }}
          onNodeClick={(_, node) => { setSelectedNodeId(node.id); setSelectedEdgeId(null) }}
          onPaneClick={() => { setSelectedEdgeId(null); setSelectedNodeId(null) }}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap pannable zoomable className="!bg-card" />
        </ReactFlow>

        {selectedEdge && (
          <SocialFunnelEdgePanel
            condition={selectedEdgeCondition}
            buttonLabel={selectedButtonLabel}
            onChange={updateSelectedCondition}
            onRemoveEdge={removeSelectedEdge}
            onClose={() => setSelectedEdgeId(null)}
          />
        )}

        {selectedNodeStep && (
          <SocialFunnelNodeEditPanel
            step={selectedNodeStep}
            onChange={updateSelectedStep}
            onClose={() => setSelectedNodeId(null)}
          />
        )}
      </div>
    </div>
  )
}
