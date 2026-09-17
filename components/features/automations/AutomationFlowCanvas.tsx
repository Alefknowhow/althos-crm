'use client'

/**
 * Canvas de edição de uma automação — substitui a lista horizontal linear
 * (histórico em AutomationFlow.tsx.old / ver commit anterior) por um canvas
 * livre com @xyflow/react, mesmo padrão do funil de Instagram
 * (SocialFunnelCanvas.tsx): nodes compactos, clique abre painel de
 * configuração no canto, arrastar uma conexão define/ramifica o fluxo.
 *
 * `automations.flow` (edges + positions) já existia no schema (migration
 * 0252) e o motor (lib/inngest/automation-run-graph.ts) já sabia lê-lo —
 * só a UI não desenhava um canvas de verdade. `auto.steps` continua sendo a
 * fonte da verdade dos PASSOS em si (tipo/config); o canvas é a camada
 * visual de posição/conexão por cima, igual ao funil de Instagram.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, addEdge,
  useNodesState, useEdgesState, type Node, type Edge, type Connection,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Plus, AlertTriangle } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import type { AutomationFlow, AutomationFlowEdge, AutomationEdgeCondition } from '@/lib/automations/automation-traversal'
import AutomationFlowCanvasNode, { type AutomationCanvasNodeData } from './AutomationFlowCanvasNode'
import AutomationFlowNodeEditPanel from './AutomationFlowNodeEditPanel'
import AutomationFlowEdgePanel from './AutomationFlowEdgePanel'
import DeletableEdge from '../flow/DeletableEdge'
import {
  STEP_TYPES, describeTrigger, describeStep, type Step, type StepStat, type WaTemplate, type FormOpt, type StageOpt,
} from './AutomationFlowMeta'

const NODE_TYPES = { automation: AutomationFlowCanvasNode }
const EDGE_TYPES = { default: DeletableEdge }
const NODE_GAP_Y = 140

function buildInitialGraph(
  steps: Step[], auto: any, opts: { forms: FormOpt[]; stages: StageOpt[] },
): { nodes: Node<AutomationCanvasNodeData>[]; edges: Edge[] } {
  const { forms, stages } = opts
  const flow: AutomationFlow | undefined = auto.flow
  const ids = steps.map(s => s.id)
  const chain = ['trigger', ...ids, 'end']
  const positions = flow?.positions || {}

  const nodes: Node<AutomationCanvasNodeData>[] = chain.map((id, i) => {
    const step = ids.includes(id) ? steps[ids.indexOf(id)] : null
    const kind: AutomationCanvasNodeData['kind'] = id === 'trigger' ? 'trigger' : id === 'end' ? 'end' : 'step'
    const label = kind === 'trigger'
      ? describeTrigger(auto.trigger_type, auto.trigger_config, forms, stages) || 'Qualquer disparo'
      : kind === 'step' && step ? describeStep(step, stages) || 'Sem configuração'
      : ''
    return {
      id,
      type: 'automation',
      position: positions[id] || { x: 40, y: i * NODE_GAP_Y },
      data: { kind, typeId: kind === 'trigger' ? auto.trigger_type : step?.type, label },
    }
  })

  const savedEdges = flow?.edges
  const sourceEdges: AutomationFlowEdge[] = savedEdges && savedEdges.length > 0
    ? savedEdges
    : chain.slice(0, -1).map((id, i) => ({ id: `${id}->${chain[i + 1]}`, from: id, to: chain[i + 1] }))

  const edges: Edge[] = sourceEdges.map(e => ({
    id: e.id,
    source: e.from,
    target: e.to,
    sourceHandle: 'default',
    animated: !e.condition,
    label: e.condition?.type === 'keyword' ? 'palavra-chave' : e.condition?.type === 'button' ? `botão ${e.condition.buttonIndex}` : undefined,
    data: { condition: e.condition },
  }))

  return { nodes, edges }
}

/** true quando o step é 'send_instagram_dm' — só pode existir num fluxo
 *  cujo gatilho seja de Instagram (regra de negócio pedida explicitamente:
 *  um disparo de Instagram só é aceito com um trigger de Instagram). */
function isInstagramTrigger(triggerType: string): boolean {
  return triggerType === 'instagram.dm.received' || triggerType === 'instagram.comment.received'
}

type Props = {
  auto: any
  setAuto: (next: any) => void
  forms: FormOpt[]
  stages: StageOpt[]
  stepStats?: Record<number, StepStat>
  whatsappTemplates?: WaTemplate[]
  niche?: string | null
}

export default function AutomationFlowCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <AutomationFlowCanvasInner {...props} />
    </ReactFlowProvider>
  )
}

function AutomationFlowCanvasInner({ auto, setAuto, forms, stages, whatsappTemplates, niche }: Props) {
  const steps: Step[] = useMemo(() => auto.steps || [], [auto.steps])
  function setSteps(next: Step[]) { setAuto({ ...auto, steps: next }) }

  // Estado inicial derivado UMA vez na abertura — depois disso o canvas é a
  // fonte da verdade (mesmo padrão de SocialFunnelCanvas.tsx/FormFlowCanvas.tsx).
  const initial = useMemo(() => buildInitialGraph(steps, auto, { forms, stages }), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)

  const stepsById = useMemo(() => new Map(steps.map(s => [s.id, s])), [steps])

  // Persiste posições + edges em auto.flow a cada mudança — o array
  // `steps` (tipo/config de cada passo) é editado à parte, direto pelos
  // callbacks abaixo (setSteps/patch), não por aqui.
  const setAutoRef = useRef(setAuto)
  setAutoRef.current = setAuto
  useEffect(() => {
    const positions: Record<string, { x: number; y: number }> = {}
    for (const n of nodes) positions[n.id] = n.position
    setAutoRef.current((prev: any) => ({
      ...prev,
      flow: {
        positions,
        edges: edges.map(e => ({
          id: e.id,
          from: e.source,
          to: e.target,
          condition: (e.data as any)?.condition as AutomationEdgeCondition | undefined,
        })),
      },
    }))
  }, [nodes, edges])

  function onConnect(connection: Connection) {
    setEdges(curr => addEdge({ ...connection, sourceHandle: 'default', animated: true, data: {} }, curr))
  }

  // Sincroniza label/typeId dos nodes sempre que trigger ou steps mudam
  // (edição pelo painel de config não atualiza o node sozinha).
  useEffect(() => {
    setNodes(curr => curr.map(n => {
      if (n.data.kind === 'trigger') {
        return { ...n, data: { ...n.data, typeId: auto.trigger_type, label: describeTrigger(auto.trigger_type, auto.trigger_config, forms, stages) } }
      }
      if (n.data.kind === 'step') {
        const step = stepsById.get(n.id)
        if (!step) return n
        return { ...n, data: { ...n.data, typeId: step.type, label: describeStep(step, stages) } }
      }
      return n
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto.trigger_type, auto.trigger_config, steps])

  function setStepEdges(stepId: string, nextEdges: AutomationFlowEdge[]) {
    setEdges(curr => [
      ...curr.filter(e => e.source !== stepId),
      ...nextEdges.map(e => ({
        id: e.id,
        source: e.from,
        target: e.to,
        sourceHandle: 'default',
        animated: !e.condition,
        label: e.condition?.type === 'keyword' ? 'palavra-chave' : e.condition?.type === 'button' ? `botão ${e.condition.buttonIndex}` : undefined,
        data: { condition: e.condition },
      })),
    ])
  }

  function addStep(type: string) {
    const newStep: Step = { id: `step_${Date.now()}`, type, config: {} }
    if (type === 'wait')        newStep.config = { amount: 1, unit: 'minutes' }
    if (type === 'create_task') newStep.config = { title: 'Nova Tarefa', priority: 'normal', dueInDays: 1 }
    setSteps([...steps, newStep])

    const basePos = nodes.find(n => n.id === selectedNodeId)?.position
      ?? { x: 40, y: Math.max(0, ...nodes.map(n => n.position.y)) + NODE_GAP_Y }
    const newPos = { x: basePos.x + 260, y: basePos.y }
    setNodes(curr => [...curr, {
      id: newStep.id,
      type: 'automation',
      position: newPos,
      data: { kind: 'step', typeId: type, label: '' },
    }])
    if (selectedNodeId) {
      setEdges(curr => addEdge({ id: `${selectedNodeId}->${newStep.id}`, source: selectedNodeId, target: newStep.id, sourceHandle: 'default', animated: true, data: {} }, curr))
    }
    setSelectedNodeId(newStep.id)
    setSelectedEdgeId(null)
  }

  function removeStep(stepId: string) {
    setSteps(steps.filter(s => s.id !== stepId))
    setNodes(curr => curr.filter(n => n.id !== stepId))
    setEdges(curr => curr.filter(e => e.source !== stepId && e.target !== stepId))
    if (selectedNodeId === stepId) setSelectedNodeId(null)
  }

  const selectedNode = nodes.find(n => n.id === selectedNodeId) || null
  const selectedStep = selectedNode?.data.kind === 'step' ? stepsById.get(selectedNode.id) || null : null
  const selectedStepIndex = selectedStep ? steps.indexOf(selectedStep) : -1

  const selectedEdge = edges.find(e => e.id === selectedEdgeId) || null
  const selectedEdgeCondition = (selectedEdge?.data as any)?.condition as AutomationEdgeCondition | undefined
  const selectedEdgeSourceIsWait = selectedEdge ? stepsById.get(selectedEdge.source)?.type === 'wait_for_reply' : false

  function updateSelectedEdgeCondition(condition: AutomationEdgeCondition | undefined) {
    setEdges(curr => curr.map(e => e.id === selectedEdgeId
      ? { ...e, animated: !condition, label: condition?.type === 'keyword' ? 'palavra-chave' : condition?.type === 'button' ? `botão ${condition.buttonIndex}` : undefined, data: { condition } }
      : e))
  }

  function removeSelectedEdge() {
    setEdges(curr => curr.filter(e => e.id !== selectedEdgeId))
    setSelectedEdgeId(null)
  }

  // Regra pedida: "DM do Instagram" só pode ser adicionado se o gatilho for
  // de Instagram — um gatilho de Instagram continua livre pra disparar
  // qualquer outro tipo de passo normalmente (sem restrição no sentido
  // inverso).
  const triggerIsInstagram = isInstagramTrigger(auto.trigger_type)
  const addableStepTypes = STEP_TYPES.filter(t => t.id !== 'send_instagram_dm' || triggerIsInstagram)
  const hasInvalidInstagramStep = !triggerIsInstagram && steps.some(s => s.type === 'send_instagram_dm')

  return (
    <div className="absolute inset-0 bg-background flex flex-col">
      <div className="flex items-center justify-between px-4 py-2.5 border-b shrink-0 gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Fluxo da automação</p>
          <p className="text-xs text-muted-foreground">Clique num passo pra editar. Arraste a partir de um passo pra conectar/ramificar.</p>
        </div>
        {hasInvalidInstagramStep && (
          <div className="flex items-center gap-1.5 text-xs text-destructive shrink-0">
            <AlertTriangle className="w-3.5 h-3.5" />
            "DM do Instagram" precisa de um gatilho de Instagram
          </div>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="shrink-0"><Plus className="w-4 h-4 mr-1" /> Adicionar passo</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 max-h-[60vh] overflow-y-auto">
            <DropdownMenuLabel className="text-xs">Adicionar passo</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {addableStepTypes.map(t => (
              <DropdownMenuItem key={t.id} onClick={() => addStep(t.id)}>
                <t.icon className="w-4 h-4 mr-2 shrink-0" style={{ color: t.color }} />
                <span className="text-sm">{t.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
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
          <AutomationFlowEdgePanel
            condition={selectedEdgeCondition}
            sourceIsWaitForReply={selectedEdgeSourceIsWait}
            onChange={updateSelectedEdgeCondition}
            onRemoveEdge={removeSelectedEdge}
            onClose={() => setSelectedEdgeId(null)}
          />
        )}

        {selectedNode?.data.kind === 'trigger' && (
          <AutomationFlowNodeEditPanel
            kind="trigger"
            auto={auto}
            setAuto={setAuto}
            steps={steps}
            setSteps={setSteps}
            forms={forms}
            stages={stages}
            niche={niche}
            flowEdges={[]}
            setStepEdges={setStepEdges}
            onClose={() => setSelectedNodeId(null)}
          />
        )}

        {selectedStep && selectedStepIndex >= 0 && (
          <AutomationFlowNodeEditPanel
            kind="step"
            auto={auto}
            setAuto={setAuto}
            step={selectedStep}
            index={selectedStepIndex}
            steps={steps}
            setSteps={setSteps}
            forms={forms}
            stages={stages}
            whatsappTemplates={whatsappTemplates}
            niche={niche}
            flowEdges={edges.map(e => ({ id: e.id, from: e.source, to: e.target, condition: (e.data as any)?.condition }))}
            setStepEdges={setStepEdges}
            onDeleteStep={() => removeStep(selectedStep.id)}
            onClose={() => setSelectedNodeId(null)}
          />
        )}
      </div>
    </div>
  )
}
