'use client'

import { X, GripHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TriggerConfig } from './AutomationFlowTriggerConfig'
import { StepConfig } from './AutomationFlowStepConfig'
import { stepMeta, triggerMeta, type Step, type FormOpt, type StageOpt, type WaTemplate } from './AutomationFlowMeta'
import type { AutomationFlowEdge } from '@/lib/automations/automation-traversal'
import { useDraggablePosition } from './useDraggablePanel'

/**
 * Painel de configuração no canto superior esquerdo — aberto ao clicar num
 * node do canvas. Reaproveita TriggerConfig/StepConfig (mesmos campos de
 * sempre, só movidos pra dentro de um painel em vez de ficarem sempre
 * visíveis no card), mesmo padrão do canvas de funil de Instagram
 * (SocialFunnelNodeEditPanel.tsx).
 */
const PANEL_WIDTH = 440

export default function AutomationFlowNodeEditPanel({
  kind, auto, setAuto, step, index, steps, setSteps, forms, stages, whatsappTemplates, niche,
  flowEdges, setStepEdges, onDeleteStep, onClose, anchor,
}: {
  kind: 'trigger' | 'step'
  auto: any
  setAuto: (n: any) => void
  step?: Step
  index?: number
  steps: Step[]
  setSteps: (s: Step[]) => void
  forms: FormOpt[]
  stages: StageOpt[]
  whatsappTemplates?: WaTemplate[]
  niche?: string | null
  flowEdges: AutomationFlowEdge[]
  setStepEdges: (stepId: string, edges: AutomationFlowEdge[]) => void
  onDeleteStep?: () => void
  onClose: () => void
  /** Posição do clique relativa ao container do canvas — o painel abre do
   *  lado do mouse em vez de sempre no canto superior esquerdo. Ausente ⇒
   *  cai no canto (fallback, ex.: aberto por outro fluxo que não um clique). */
  anchor?: { x: number; y: number; containerWidth: number; containerHeight: number }
}) {
  const title = kind === 'trigger' ? triggerMeta(auto.trigger_type).label : stepMeta(step?.type || '').label

  const anchorStyle = anchor
    ? {
        top: Math.max(12, Math.min(anchor.y, anchor.containerHeight - 120)),
        left: Math.max(12, Math.min(anchor.x + 16, anchor.containerWidth - PANEL_WIDTH - 12)),
      }
    : { top: 12, left: 12 }
  const { style, onHeaderMouseDown } = useDraggablePosition(anchorStyle)

  return (
    <div
      className="absolute z-10 max-h-[calc(100vh-5rem)] overflow-y-auto rounded-md border bg-card shadow-lg p-3 space-y-3"
      style={{ width: PANEL_WIDTH, ...(style ?? anchorStyle) }}
    >
      <div
        onMouseDown={onHeaderMouseDown}
        className="flex items-center justify-between gap-2 cursor-move select-none -mx-3 -mt-3 px-3 pt-3 pb-1"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <GripHorizontal className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
          <p className="text-sm font-semibold truncate">{title}</p>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0" aria-label="Fechar">
          <X className="w-4 h-4" />
        </button>
      </div>

      {kind === 'trigger' ? (
        <TriggerConfig auto={auto} setAuto={setAuto} forms={forms} stages={stages} niche={niche} />
      ) : step && index !== undefined ? (
        <StepConfig
          step={step}
          index={index}
          steps={steps}
          setSteps={setSteps}
          stages={stages}
          whatsappTemplates={whatsappTemplates}
          flowEdges={flowEdges}
          setStepEdges={setStepEdges}
        />
      ) : null}

      {kind === 'step' && step && (
        <div className="pt-1 border-t">
          <Button type="button" size="sm" variant="ghost" className="text-xs h-7 text-destructive hover:text-destructive w-full" onClick={onDeleteStep}>
            Remover passo
          </Button>
        </div>
      )}
    </div>
  )
}
