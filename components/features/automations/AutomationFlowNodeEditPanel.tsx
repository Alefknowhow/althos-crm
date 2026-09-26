'use client'

import { X } from 'lucide-react'
import { Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TriggerConfig } from './AutomationFlowTriggerConfig'
import { StepConfig } from './AutomationFlowStepConfig'
import { stepMeta, triggerMeta, TRIGGER_COLOR, type Step, type FormOpt, type StageOpt, type WaTemplate } from './AutomationFlowMeta'
import type { AutomationFlowEdge } from '@/lib/automations/automation-traversal'

/**
 * Inspector Panel — coluna fixa à esquerda do canvas, aberta ao clicar num
 * node. Substitui o antigo popup ancorado no clique (ver histórico):
 * largura fixa, sem overlay, não sobrepõe o canvas (o canvas encolhe ao
 * lado, ver AutomationFlowCanvas.tsx). Mesmo componente pra qualquer tipo
 * de node — trigger ou qualquer step — reaproveitando TriggerConfig/
 * StepConfig como conteúdo.
 */
export const INSPECTOR_PANEL_WIDTH = 380

export default function AutomationFlowNodeEditPanel({
  kind, auto, setAuto, step, index, steps, setSteps, forms, stages, whatsappTemplates, agentDefinitions, niche,
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
  agentDefinitions?: { id: string; name: string }[]
  niche?: string | null
  flowEdges: AutomationFlowEdge[]
  setStepEdges: (stepId: string, edges: AutomationFlowEdge[]) => void
  onDeleteStep?: () => void
  onClose: () => void
}) {
  const meta = kind === 'trigger'
    ? { icon: Zap, color: TRIGGER_COLOR, label: triggerMeta(auto.trigger_type).label, subtitle: 'Gatilho' }
    : (() => { const m = stepMeta(step?.type || ''); return { icon: m.icon, color: m.color, label: m.label, subtitle: 'Passo' } })()
  const Icon = meta.icon

  return (
    <div
      className="h-full shrink-0 border-r bg-card flex flex-col"
      style={{ width: INSPECTOR_PANEL_WIDTH }}
    >
      <div className="flex items-center gap-2.5 px-4 py-3 border-b shrink-0">
        <span className="w-8 h-8 rounded-lg shrink-0 grid place-items-center" style={{ backgroundColor: `${meta.color}20`, color: meta.color }}>
          <Icon className="w-4 h-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{meta.label}</p>
          <p className="text-xs text-muted-foreground truncate">{meta.subtitle}</p>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0" aria-label="Fechar painel">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
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
            agentDefinitions={agentDefinitions}
            flowEdges={flowEdges}
            setStepEdges={setStepEdges}
          />
        ) : null}
      </div>

      {kind === 'step' && step && (
        <div className="px-4 py-3 border-t shrink-0">
          <Button type="button" size="sm" variant="ghost" className="text-xs h-8 text-destructive hover:text-destructive w-full" onClick={onDeleteStep}>
            Remover passo
          </Button>
        </div>
      )}
    </div>
  )
}
