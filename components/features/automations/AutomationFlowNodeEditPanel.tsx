'use client'

import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TriggerConfig } from './AutomationFlowTriggerConfig'
import { StepConfig } from './AutomationFlowStepConfig'
import { stepMeta, triggerMeta, type Step, type FormOpt, type StageOpt, type WaTemplate } from './AutomationFlowMeta'
import type { AutomationFlowEdge } from '@/lib/automations/automation-traversal'

/**
 * Painel de configuração no canto superior esquerdo — aberto ao clicar num
 * node do canvas. Reaproveita TriggerConfig/StepConfig (mesmos campos de
 * sempre, só movidos pra dentro de um painel em vez de ficarem sempre
 * visíveis no card), mesmo padrão do canvas de funil de Instagram
 * (SocialFunnelNodeEditPanel.tsx).
 */
export default function AutomationFlowNodeEditPanel({
  kind, auto, setAuto, step, index, steps, setSteps, forms, stages, whatsappTemplates, niche,
  flowEdges, setStepEdges, onDeleteStep, onClose,
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
}) {
  const title = kind === 'trigger' ? triggerMeta(auto.trigger_type).label : stepMeta(step?.type || '').label

  return (
    <div className="absolute top-3 left-3 z-10 w-80 max-h-[calc(100vh-5rem)] overflow-y-auto rounded-md border bg-card shadow-lg p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold truncate">{title}</p>
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
