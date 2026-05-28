'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  PlayCircle,
  Plus,
  Trash2,
  Clock,
  Mail,
  MessageSquare,
  CheckSquare,
  ArrowRightLeft,
  Tag,
  Zap,
  X,
  ChevronRight,
  Bell,
  Webhook,
} from 'lucide-react'

const TRIGGER_TYPES = [
  { id: 'form.submitted',       label: 'Formulário Submetido' },
  { id: 'lead.stage_changed',   label: 'Estágio Alterado' },
  { id: 'lead.tag_added',       label: 'Tag Adicionada' },
  { id: 'task.overdue',         label: 'Tarefa Vencida' },
  { id: 'lead.stale',           label: 'Lead sem contato' },
  { id: 'appointment.booked',   label: 'Agendamento Realizado' },
] as const

const STEP_TYPES = [
  { id: 'wait',          label: 'Esperar',           icon: Clock,          color: '#94a3b8' },
  { id: 'send_email',    label: 'Enviar E-mail',      icon: Mail,           color: '#ef4444' },
  { id: 'send_whatsapp', label: 'WhatsApp',           icon: MessageSquare,  color: '#10b981' },
  { id: 'create_task',   label: 'Criar Tarefa',       icon: CheckSquare,    color: '#f59e0b' },
  { id: 'move_stage',    label: 'Mover Estágio',      icon: ArrowRightLeft, color: '#3b82f6' },
  { id: 'add_tag',       label: 'Adicionar Tag',      icon: Tag,            color: '#a855f7' },
  { id: 'send_push',     label: 'Notificação Push',   icon: Bell,           color: '#0ea5e9' },
  { id: 'webhook',       label: 'Webhook Externo',    icon: Webhook,        color: '#d946ef' },
] as const

const TRIGGER_COLOR = '#7c3aed' // purple — distinctive vs action colors

type Step = { id: string; type: string; config: Record<string, any> }

type Props = {
  auto: any
  setAuto: (next: any) => void
  forms: Array<{ id: string; name: string }>
  stages: Array<{ id: string; name: string }>
}

type SelectedNode =
  | { kind: 'trigger' }
  | { kind: 'step'; index: number }
  | null

function stepMeta(type: string) {
  return STEP_TYPES.find(s => s.id === type) || STEP_TYPES[0]
}

function triggerLabel(type: string): string {
  return TRIGGER_TYPES.find(t => t.id === type)?.label || type
}

function describeTrigger(type: string, config: any, forms: Array<{ id: string; name: string }>, stages: Array<{ id: string; name: string }>): string {
  if (type === 'form.submitted') {
    if (!config?.formId) return 'Qualquer formulário'
    return forms.find(f => f.id === config.formId)?.name || 'Formulário'
  }
  if (type === 'lead.stage_changed') {
    if (!config?.stageId) return 'Qualquer estágio'
    return stages.find(s => s.id === config.stageId)?.name || 'Estágio'
  }
  if (type === 'lead.tag_added') {
    return config?.tag ? `Tag: ${config.tag}` : 'Qualquer tag'
  }
  if (type === 'task.overdue') {
    return 'Quando uma tarefa vence'
  }
  if (type === 'lead.stale') {
    const days = config?.staleDays ?? 7
    return `Sem contato há ${days} dias`
  }
  if (type === 'appointment.booked') {
    return 'Novo agendamento recebido'
  }
  return ''
}

function describeStep(step: Step, stages: Array<{ id: string; name: string }>): string {
  const c = step.config || {}
  switch (step.type) {
    case 'wait': {
      const u = c.unit || 'minutes'
      const n = c.amount ?? 1
      const unit = u === 'minutes' ? 'min' : u === 'hours' ? 'h' : 'd'
      return `${n} ${unit}`
    }
    case 'send_email':
      return c.templateId ? 'Template selecionado' : 'Sem template'
    case 'send_whatsapp':
      return c.templateName || 'Sem template'
    case 'create_task':
      return c.title || 'Nova Tarefa'
    case 'move_stage':
      return stages.find(s => s.id === c.stageId)?.name || 'Sem estágio'
    case 'add_tag':
      return c.tag ? `Tag: ${c.tag}` : 'Sem tag'
    case 'send_push':
      return c.title || 'Sem título'
    case 'webhook':
      return c.url ? c.url.replace(/^https?:\/\//, '').slice(0, 30) : 'Sem URL'
    default:
      return ''
  }
}

/* -------- Node -------- */

function Node({
  icon: Icon,
  color,
  label,
  subtitle,
  number,
  onClick,
  onDelete,
  isTrigger,
}: {
  icon: any
  color: string
  label: string
  subtitle: string
  number?: string
  onClick: () => void
  onDelete?: () => void
  isTrigger?: boolean
}) {
  return (
    <div className="relative group/node shrink-0">
      <button
        type="button"
        onClick={onClick}
        className="w-[200px] bg-card border rounded-xl shadow-sm hover:shadow-md hover:border-primary transition-all flex items-center gap-3 p-3 text-left"
        style={{ borderTopColor: color, borderTopWidth: 3 }}
      >
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${color}1a`, color }}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            {isTrigger ? 'Gatilho' : `Passo ${number}`}
          </div>
          <div className="text-sm font-semibold truncate">{label}</div>
          <div className="text-xs text-muted-foreground truncate">{subtitle}</div>
        </div>
      </button>

      {onDelete && (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            onDelete()
          }}
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover/node:opacity-100 transition-opacity flex items-center justify-center shadow-md"
          title="Remover passo"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}

/* -------- Insert button between nodes -------- */

function InsertButton({ onSelect }: { onSelect: (stepType: string) => void }) {
  return (
    <div className="relative flex items-center justify-center shrink-0 group/insert">
      {/* Connector line */}
      <div className="absolute inset-0 flex items-center">
        <div className="h-px w-full bg-border" />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="relative w-7 h-7 rounded-full bg-background border-2 border-border opacity-30 group-hover/insert:opacity-100 hover:border-primary hover:bg-primary hover:text-primary-foreground transition-all flex items-center justify-center shadow-sm"
            title="Adicionar passo aqui"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel className="text-xs">Adicionar passo</DropdownMenuLabel>
          {STEP_TYPES.map(t => (
            <DropdownMenuItem key={t.id} onClick={() => onSelect(t.id)}>
              <t.icon className="w-4 h-4 mr-2" style={{ color: t.color }} />
              {t.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

/* -------- Config sheet content (trigger + step variants) -------- */

function TriggerConfigSheet({
  auto,
  setAuto,
  forms,
  stages,
}: {
  auto: any
  setAuto: (n: any) => void
  forms: Array<{ id: string; name: string }>
  stages: Array<{ id: string; name: string }>
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Evento de disparo</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          value={auto.trigger_type}
          onChange={e => setAuto({ ...auto, trigger_type: e.target.value, trigger_config: {} })}
        >
          {TRIGGER_TYPES.map(t => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {auto.trigger_type === 'form.submitted' && (
        <div className="space-y-2">
          <Label>Formulário</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            value={auto.trigger_config?.formId || ''}
            onChange={e => setAuto({ ...auto, trigger_config: { formId: e.target.value } })}
          >
            <option value="">Qualquer formulário</option>
            {forms.map(f => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {auto.trigger_type === 'lead.stage_changed' && (
        <div className="space-y-2">
          <Label>Estágio que dispara</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            value={auto.trigger_config?.stageId || ''}
            onChange={e => setAuto({ ...auto, trigger_config: { stageId: e.target.value } })}
          >
            <option value="">Qualquer estágio</option>
            {stages.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {auto.trigger_type === 'lead.tag_added' && (
        <div className="space-y-2">
          <Label>Tag adicionada</Label>
          <Input
            placeholder="Ex: VIP"
            value={auto.trigger_config?.tag || ''}
            onChange={e => setAuto({ ...auto, trigger_config: { tag: e.target.value } })}
          />
        </div>
      )}

      {auto.trigger_type === 'lead.stale' && (
        <div className="space-y-2">
          <Label>Dias sem contato</Label>
          <Input
            type="number"
            min={1}
            max={365}
            placeholder="7"
            value={auto.trigger_config?.staleDays ?? 7}
            onChange={e =>
              setAuto({ ...auto, trigger_config: { staleDays: parseInt(e.target.value) || 7 } })
            }
          />
          <p className="text-xs text-muted-foreground">
            Dispara quando um lead não tem nenhuma atividade registrada há esse número de dias.
          </p>
        </div>
      )}

      {auto.trigger_type === 'task.overdue' && (
        <p className="text-sm text-muted-foreground">
          Dispara automaticamente quando uma tarefa vinculada a um lead vence (verificação diária às 8h).
        </p>
      )}

      {auto.trigger_type === 'appointment.booked' && (
        <p className="text-sm text-muted-foreground">
          Dispara quando um agendamento é criado pelo formulário público de booking.
        </p>
      )}
    </div>
  )
}

function StepConfigSheet({
  step,
  index,
  steps,
  setSteps,
  stages,
}: {
  step: Step
  index: number
  steps: Step[]
  setSteps: (s: Step[]) => void
  stages: Array<{ id: string; name: string }>
}) {
  function patch(configUpdates: Record<string, any>) {
    const next = [...steps]
    next[index] = { ...next[index], config: { ...next[index].config, ...configUpdates } }
    setSteps(next)
  }

  switch (step.type) {
    case 'wait':
      return (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Quantidade</Label>
            <Input
              type="number"
              min={1}
              value={step.config.amount ?? 1}
              onChange={e => patch({ amount: parseInt(e.target.value) || 1 })}
            />
          </div>
          <div className="space-y-2">
            <Label>Unidade</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={step.config.unit || 'minutes'}
              onChange={e => patch({ unit: e.target.value })}
            >
              <option value="minutes">Minutos</option>
              <option value="hours">Horas</option>
              <option value="days">Dias</option>
            </select>
          </div>
        </div>
      )

    case 'send_email':
      return (
        <div className="space-y-2">
          <Label>Template ID</Label>
          <Input
            placeholder="ID do template de e-mail"
            value={step.config.templateId || ''}
            onChange={e => patch({ templateId: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Cole o ID do template criado em "Templates de E-mail".
          </p>
        </div>
      )

    case 'send_whatsapp':
      return (
        <div className="space-y-2">
          <Label>Nome do template HSM</Label>
          <Input
            placeholder="boas_vindas_v1"
            value={step.config.templateName || ''}
            onChange={e => patch({ templateName: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Nome do template aprovado no Meta Business Manager.
          </p>
        </div>
      )

    case 'create_task':
      return (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Título da tarefa</Label>
            <Input
              placeholder="Ex: Ligar para o lead"
              value={step.config.title || ''}
              onChange={e => patch({ title: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Prazo (dias)</Label>
              <Input
                type="number"
                min={1}
                value={step.config.dueInDays ?? 1}
                onChange={e => patch({ dueInDays: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={step.config.priority || 'normal'}
                onChange={e => patch({ priority: e.target.value })}
              >
                <option value="low">Baixa</option>
                <option value="normal">Normal</option>
                <option value="high">Alta</option>
              </select>
            </div>
          </div>
        </div>
      )

    case 'move_stage':
      return (
        <div className="space-y-2">
          <Label>Mover para o estágio</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            value={step.config.stageId || ''}
            onChange={e => patch({ stageId: e.target.value })}
          >
            <option value="">Selecione...</option>
            {stages.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )

    case 'add_tag':
      return (
        <div className="space-y-2">
          <Label>Nome da tag</Label>
          <Input
            placeholder="Ex: VIP"
            value={step.config.tag || ''}
            onChange={e => patch({ tag: e.target.value })}
          />
        </div>
      )

    case 'send_push':
      return (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input
              placeholder="Ex: Novo lead no funil"
              value={step.config.title || ''}
              onChange={e => patch({ title: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Corpo da mensagem</Label>
            <Input
              placeholder="Ex: {{lead.name}} entrou no estágio {{stage}}"
              value={step.config.body || ''}
              onChange={e => patch({ body: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Variáveis disponíveis: <code className="bg-muted px-1 rounded">{'{{lead.name}}'}</code>{' '}
              <code className="bg-muted px-1 rounded">{'{{lead.email}}'}</code>{' '}
              <code className="bg-muted px-1 rounded">{'{{lead.phone}}'}</code>
            </p>
          </div>
        </div>
      )

    case 'webhook':
      return (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>URL do webhook</Label>
            <Input
              type="url"
              placeholder="https://hooks.exemplo.com/notify"
              value={step.config.url || ''}
              onChange={e => patch({ url: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Método</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={step.config.method || 'POST'}
              onChange={e => patch({ method: e.target.value })}
            >
              <option value="POST">POST</option>
              <option value="GET">GET</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Headers extras (JSON)</Label>
            <Input
              placeholder={'{"Authorization": "Bearer token"}'}
              value={step.config.headers || ''}
              onChange={e => patch({ headers: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Opcional. O corpo sempre inclui dados do lead em JSON.
            </p>
          </div>
        </div>
      )

    default:
      return null
  }
}

/* -------- Main flow -------- */

export default function AutomationFlow({ auto, setAuto, forms, stages }: Props) {
  const [selected, setSelected] = useState<SelectedNode>(null)

  const steps: Step[] = auto.steps || []

  function setSteps(next: Step[]) {
    setAuto({ ...auto, steps: next })
  }

  function insertStep(atIndex: number, type: string) {
    const newStep: Step = { id: `step_${Date.now()}`, type, config: {} }
    if (type === 'wait') newStep.config = { amount: 1, unit: 'minutes' }
    if (type === 'create_task') newStep.config = { title: 'Nova Tarefa', priority: 'normal', dueInDays: 1 }
    const next = [...steps]
    next.splice(atIndex, 0, newStep)
    setSteps(next)
  }

  function removeStep(index: number) {
    const next = [...steps]
    next.splice(index, 1)
    setSteps(next)
    if (selected?.kind === 'step' && selected.index === index) setSelected(null)
  }

  const selectedStep =
    selected?.kind === 'step' && steps[selected.index] ? steps[selected.index] : null
  const selectedStepMeta = selectedStep ? stepMeta(selectedStep.type) : null

  return (
    <div className="relative h-full bg-muted/20 overflow-auto">
      {/* Background grid pattern — gives the n8n "canvas" feel */}
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle, currentColor 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          color: 'hsl(var(--border))',
        }}
      />

      <div className="relative min-h-full flex items-center px-8 py-12">
        <div className="flex items-center gap-2 min-w-fit">
          {/* Trigger node */}
          <Node
            icon={Zap}
            color={TRIGGER_COLOR}
            label={triggerLabel(auto.trigger_type)}
            subtitle={describeTrigger(auto.trigger_type, auto.trigger_config, forms, stages)}
            onClick={() => setSelected({ kind: 'trigger' })}
            isTrigger
          />

          {/* First insert button (before step 0) */}
          <InsertButton onSelect={t => insertStep(0, t)} />

          {/* Step nodes interleaved with insert buttons */}
          {steps.map((step, i) => {
            const meta = stepMeta(step.type)
            return (
              <div key={step.id || i} className="flex items-center gap-2">
                <Node
                  icon={meta.icon}
                  color={meta.color}
                  label={meta.label}
                  subtitle={describeStep(step, stages)}
                  number={String(i + 1)}
                  onClick={() => setSelected({ kind: 'step', index: i })}
                  onDelete={() => removeStep(i)}
                />
                <InsertButton onSelect={t => insertStep(i + 1, t)} />
              </div>
            )
          })}

          {/* End marker */}
          {steps.length > 0 && (
            <div className="shrink-0 flex items-center gap-2 ml-2 text-muted-foreground">
              <ChevronRight className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wider font-medium">Fim</span>
            </div>
          )}
        </div>
      </div>

      {/* Config sheet */}
      <Sheet open={!!selected} onOpenChange={o => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selected?.kind === 'trigger' && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${TRIGGER_COLOR}1a`, color: TRIGGER_COLOR }}
                  >
                    <Zap className="w-4 h-4" />
                  </div>
                  Gatilho
                </SheetTitle>
                <SheetDescription>O evento que inicia esta automação.</SheetDescription>
              </SheetHeader>
              <div className="mt-6">
                <TriggerConfigSheet auto={auto} setAuto={setAuto} forms={forms} stages={stages} />
              </div>
            </>
          )}

          {selected?.kind === 'step' && selectedStep && selectedStepMeta && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{
                      backgroundColor: `${selectedStepMeta.color}1a`,
                      color: selectedStepMeta.color,
                    }}
                  >
                    <selectedStepMeta.icon className="w-4 h-4" />
                  </div>
                  Passo {selected.index + 1} — {selectedStepMeta.label}
                </SheetTitle>
                <SheetDescription>
                  Configure o que esse passo faz quando a execução chegar nele.
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6">
                <StepConfigSheet
                  step={selectedStep}
                  index={selected.index}
                  steps={steps}
                  setSteps={setSteps}
                  stages={stages}
                />

                <div className="mt-8 pt-4 border-t">
                  <Button
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => removeStep(selected.index)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> Remover passo
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
