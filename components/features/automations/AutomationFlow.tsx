'use client'

/**
 * AutomationFlow — lista horizontal de steps (Trigger → Passo 1 → Passo 2 → …),
 * da esquerda pra direita, com rolagem horizontal quando não cabe na tela.
 *
 * Antes disso era um canvas livre (posição arbitrária por nó, conectores SVG,
 * drag-to-connect estilo N8N — ver histórico do commit). Removido porque o
 * motor de execução (lib/inngest/automation.ts) NUNCA leu o grafo (__edges) —
 * sempre executou `automation.steps` como array linear, na ordem em que está
 * salvo. O canvas era só uma camada de edição visual sobre esse mesmo array;
 * esta lista edita o array diretamente, sem indireção nenhuma (a orientação
 * horizontal, em vez da vertical usada antes, é só um reflow do mesmo layout).
 *
 * `trigger_config.__edges`/`step.config.__pos` de automações antigas (criadas
 * antes dessa mudança) ficam como JSON órfão inofensivo — nunca foram lidos
 * pelo motor, e esta versão nunca mais escreve neles.
 */

import { Zap } from 'lucide-react'
import { FlowNode, Connector } from './AutomationFlowNode'
import { TriggerConfig } from './AutomationFlowTriggerConfig'
import { StepConfig } from './AutomationFlowStepConfig'
import {
  TRIGGER_COLOR,
  stepMeta,
  triggerMeta,
  describeTrigger,
  describeStep,
  type Step,
  type StepStat,
  type WaTemplate,
} from './AutomationFlowMeta'

type Props = {
  auto: any
  setAuto: (next: any) => void
  forms: Array<{ id: string; name: string }>
  stages: Array<{ id: string; name: string }>
  stepStats?: Record<number, StepStat>
  whatsappTemplates?: WaTemplate[]
  /** Nicho da org — filtra os gatilhos de vertical (Clínicas/Imóveis/Seguros) visíveis no seletor. */
  niche?: string | null
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AutomationFlow({ auto, setAuto, forms, stages, stepStats, whatsappTemplates, niche }: Props) {
  const steps: Step[] = auto.steps || []

  function setSteps(next: Step[]) { setAuto({ ...auto, steps: next }) }

  // Insere um step novo na posição `at` (índice dentro de `steps`).
  function insertStep(at: number, type: string) {
    const newStep: Step = { id: `step_${Date.now()}`, type, config: {} }
    if (type === 'wait')        newStep.config = { amount: 1, unit: 'minutes' }
    if (type === 'create_task') newStep.config = { title: 'Nova Tarefa', priority: 'normal', dueInDays: 1 }
    const next = [...steps]
    next.splice(at, 0, newStep)
    setSteps(next)
  }

  function removeStep(index: number) {
    setSteps(steps.filter((_, i) => i !== index))
  }

  return (
    <div className="h-full overflow-auto bg-muted/20 py-8 px-4">
      <div className="flex flex-row items-start gap-0 min-w-max">
        {/* Trigger — fixado na borda esquerda: continua visível mesmo
            rolando o fluxo horizontalmente pra ver passos mais à direita. */}
        <div className="sticky left-0 z-10 bg-muted/20 pr-1">
          <FlowNode
            icon={Zap}
            color={TRIGGER_COLOR}
            typeLabel="Gatilho"
            nodeName={triggerMeta(auto.trigger_type).label}
            detail={describeTrigger(auto.trigger_type, auto.trigger_config, forms, stages)}
            badge="Início"
            config={<TriggerConfig auto={auto} setAuto={setAuto} forms={forms} stages={stages} niche={niche} />}
          />
        </div>

        <Connector onInsert={type => insertStep(0, type)} />

        {/* Steps */}
        {steps.map((step, i) => {
          const meta = stepMeta(step.type)
          return (
            <div key={step.id || i} className="flex flex-row items-start">
              <FlowNode
                icon={meta.icon}
                color={meta.color}
                typeLabel={meta.label}
                nodeName={meta.label}
                detail={describeStep(step, stages)}
                badge={`Passo ${i + 1}`}
                onDelete={() => removeStep(i)}
                stats={stepStats?.[i] ?? { success: 0, errors: 0 }}
                config={<StepConfig step={step} index={i} steps={steps} setSteps={setSteps} stages={stages} whatsappTemplates={whatsappTemplates} />}
              />
              <Connector onInsert={type => insertStep(i + 1, type)} />
            </div>
          )
        })}

        {steps.length === 0 && (
          <p className="text-xs text-muted-foreground max-w-[220px] self-center pl-2">
            Clique no + acima pra adicionar o primeiro passo do fluxo.
          </p>
        )}
      </div>
    </div>
  )
}
