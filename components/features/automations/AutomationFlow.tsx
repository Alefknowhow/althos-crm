'use client'

/**
 * AutomationFlow — visual canvas editor (vertical layout, left config panel).
 *
 * Same data model as before (trigger + linear steps array). Pure visual
 * redesign: nodes stacked vertically with connectors, left-side config panel
 * that slides in when a node is clicked, richer node cards.
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
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
  Bell,
  Webhook,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Metadata ────────────────────────────────────────────────────────────────

const TRIGGER_TYPES = [
  { id: 'form.submitted',      label: 'Formulário Submetido',     desc: 'Dispara quando um formulário é preenchido' },
  { id: 'lead.stage_changed',  label: 'Estágio Alterado',         desc: 'Dispara quando um lead muda de estágio' },
  { id: 'lead.tag_added',      label: 'Tag Adicionada',           desc: 'Dispara quando uma tag é adicionada ao lead' },
  { id: 'task.overdue',        label: 'Tarefa Vencida',           desc: 'Dispara diariamente para tarefas em atraso' },
  { id: 'lead.stale',          label: 'Lead sem Contato',         desc: 'Dispara após N dias sem atividade' },
  { id: 'appointment.booked',  label: 'Agendamento Realizado',    desc: 'Dispara quando um agendamento é criado' },
] as const

const STEP_TYPES = [
  { id: 'send_email',    label: 'Enviar E-mail',    icon: Mail,           color: '#ef4444', desc: 'Envia um template de e-mail para o lead' },
  { id: 'send_whatsapp', label: 'WhatsApp',         icon: MessageSquare,  color: '#10b981', desc: 'Envia uma mensagem via WhatsApp Business' },
  { id: 'create_task',   label: 'Criar Tarefa',     icon: CheckSquare,    color: '#f59e0b', desc: 'Cria uma tarefa vinculada ao lead' },
  { id: 'move_stage',    label: 'Mover Estágio',    icon: ArrowRightLeft, color: '#3b82f6', desc: 'Move o lead para outro estágio do pipeline' },
  { id: 'add_tag',       label: 'Adicionar Tag',    icon: Tag,            color: '#a855f7', desc: 'Adiciona uma tag ao perfil do lead' },
  { id: 'send_push',     label: 'Notificação Push', icon: Bell,           color: '#0ea5e9', desc: 'Envia push notification para a equipe' },
  { id: 'webhook',       label: 'Webhook Externo',  icon: Webhook,        color: '#d946ef', desc: 'Chama uma URL externa com dados do lead' },
  { id: 'wait',          label: 'Aguardar',         icon: Clock,          color: '#94a3b8', desc: 'Pausa a execução por um período definido' },
] as const

const TRIGGER_COLOR = '#7c3aed'

type Step = { id: string; type: string; config: Record<string, any> }

type Props = {
  auto: any
  setAuto: (next: any) => void
  forms: Array<{ id: string; name: string }>
  stages: Array<{ id: string; name: string }>
}

type SelectedNode = { kind: 'trigger' } | { kind: 'step'; index: number } | null

// ── Helpers ──────────────────────────────────────────────────────────────────

function stepMeta(type: string) {
  return STEP_TYPES.find(s => s.id === type) ?? STEP_TYPES[STEP_TYPES.length - 1]
}

function triggerMeta(type: string) {
  return TRIGGER_TYPES.find(t => t.id === type) ?? TRIGGER_TYPES[0]
}

function describeTrigger(type: string, config: any, forms: Props['forms'], stages: Props['stages']): string {
  if (type === 'form.submitted')     return forms.find(f => f.id === config?.formId)?.name ?? 'Qualquer formulário'
  if (type === 'lead.stage_changed') return stages.find(s => s.id === config?.stageId)?.name ?? 'Qualquer estágio'
  if (type === 'lead.tag_added')     return config?.tag ? `Tag: ${config.tag}` : 'Qualquer tag'
  if (type === 'task.overdue')       return 'Verificação diária às 8h'
  if (type === 'lead.stale')         return `Sem contato há ${config?.staleDays ?? 7} dias`
  if (type === 'appointment.booked') return 'Novo agendamento recebido'
  return ''
}

function describeStep(step: Step, stages: Props['stages']): string {
  const c = step.config || {}
  switch (step.type) {
    case 'wait':          return `${c.amount ?? 1} ${c.unit === 'minutes' ? 'min' : c.unit === 'hours' ? 'h' : 'dias'}`
    case 'send_email':    return c.templateId ? 'Template selecionado' : 'Sem template configurado'
    case 'send_whatsapp': return c.templateName || 'Sem template configurado'
    case 'create_task':   return c.title || 'Nova Tarefa'
    case 'move_stage':    return stages.find(s => s.id === c.stageId)?.name ?? 'Sem estágio'
    case 'add_tag':       return c.tag ? `Tag: ${c.tag}` : 'Sem tag configurada'
    case 'send_push':     return c.title || 'Sem título configurado'
    case 'webhook':       return c.url ? c.url.replace(/^https?:\/\//, '').slice(0, 32) : 'Sem URL configurada'
    default:              return ''
  }
}

// ── FlowNode card ─────────────────────────────────────────────────────────────

function FlowNode({
  icon: Icon,
  color,
  typeLabel,
  nodeName,
  detail,
  badge,
  isSelected,
  onClick,
  onDelete,
}: {
  icon: any
  color: string
  typeLabel: string
  nodeName: string
  detail: string
  badge?: string
  isSelected: boolean
  onClick: () => void
  onDelete?: () => void
}) {
  return (
    <div className="relative group/node">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'w-[260px] bg-card border rounded-xl shadow-sm text-left transition-all duration-150',
          isSelected
            ? 'ring-2 ring-primary border-primary shadow-md'
            : 'hover:shadow-md hover:border-primary/40',
        )}
      >
        {/* Colored top strip */}
        <div
          className="h-1 rounded-t-xl w-full"
          style={{ backgroundColor: color }}
        />

        {/* Header */}
        <div className="px-3 pt-2.5 pb-2 flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${color}20`, color }}
          >
            <Icon className="w-[15px] h-[15px]" />
          </div>
          <span
            className="text-[10px] font-bold uppercase tracking-wider"
            style={{ color }}
          >
            {typeLabel}
          </span>
          {badge && (
            <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
              {badge}
            </span>
          )}
        </div>

        {/* Body */}
        <div className="px-3 pb-1 border-t border-border/40 pt-2 space-y-1">
          <p className="text-sm font-semibold leading-tight">{nodeName}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{detail}</p>
        </div>

        {/* Footer */}
        <div className="px-3 py-2 mt-1 border-t border-border/30 bg-muted/30 rounded-b-xl">
          <p className="text-[10px] text-muted-foreground/70 font-medium uppercase tracking-wider">
            Próximos passos
          </p>
        </div>
      </button>

      {/* Delete button */}
      {onDelete && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onDelete() }}
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover/node:opacity-100 transition-opacity flex items-center justify-center shadow-md z-10"
          title="Remover passo"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}

// ── Connector (line + insert button) ─────────────────────────────────────────

function Connector({ onSelect }: { onSelect: (type: string) => void }) {
  return (
    <div className="flex flex-col items-center py-0.5 group/conn">
      <div className="w-px h-5 bg-border" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title="Adicionar passo"
            className="w-7 h-7 rounded-full border-2 border-border bg-background text-muted-foreground opacity-30 group-hover/conn:opacity-100 hover:border-primary hover:bg-primary hover:text-primary-foreground transition-all flex items-center justify-center shadow-sm z-10"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" className="w-52">
          <DropdownMenuLabel className="text-xs">Adicionar passo</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {STEP_TYPES.map(t => (
            <DropdownMenuItem key={t.id} onClick={() => onSelect(t.id)}>
              <t.icon className="w-4 h-4 mr-2 shrink-0" style={{ color: t.color }} />
              <span className="text-sm">{t.label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="w-px h-5 bg-border" />
    </div>
  )
}

// ── Config panel (left side) ──────────────────────────────────────────────────

function TriggerConfig({ auto, setAuto, forms, stages }: { auto: any; setAuto: (n: any) => void; forms: Props['forms']; stages: Props['stages'] }) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Evento de disparo</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          value={auto.trigger_type}
          onChange={e => setAuto({ ...auto, trigger_type: e.target.value, trigger_config: {} })}
        >
          {TRIGGER_TYPES.map(t => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">{triggerMeta(auto.trigger_type).desc}</p>
      </div>

      {auto.trigger_type === 'form.submitted' && (
        <div className="space-y-2">
          <Label className="text-xs">Formulário</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            value={auto.trigger_config?.formId || ''}
            onChange={e => setAuto({ ...auto, trigger_config: { formId: e.target.value } })}
          >
            <option value="">Qualquer formulário</option>
            {forms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
      )}

      {auto.trigger_type === 'lead.stage_changed' && (
        <div className="space-y-2">
          <Label className="text-xs">Estágio que dispara</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            value={auto.trigger_config?.stageId || ''}
            onChange={e => setAuto({ ...auto, trigger_config: { stageId: e.target.value } })}
          >
            <option value="">Qualquer estágio</option>
            {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}

      {auto.trigger_type === 'lead.tag_added' && (
        <div className="space-y-2">
          <Label className="text-xs">Tag adicionada</Label>
          <Input
            placeholder="Ex: VIP"
            value={auto.trigger_config?.tag || ''}
            onChange={e => setAuto({ ...auto, trigger_config: { tag: e.target.value } })}
          />
        </div>
      )}

      {auto.trigger_type === 'lead.stale' && (
        <div className="space-y-2">
          <Label className="text-xs">Dias sem contato</Label>
          <Input
            type="number" min={1} max={365} placeholder="7"
            value={auto.trigger_config?.staleDays ?? 7}
            onChange={e => setAuto({ ...auto, trigger_config: { staleDays: parseInt(e.target.value) || 7 } })}
          />
        </div>
      )}
    </div>
  )
}

function StepConfig({ step, index, steps, setSteps, stages }: { step: Step; index: number; steps: Step[]; setSteps: (s: Step[]) => void; stages: Props['stages'] }) {
  function patch(u: Record<string, any>) {
    const next = [...steps]
    next[index] = { ...next[index], config: { ...next[index].config, ...u } }
    setSteps(next)
  }

  const labelClass = 'text-xs font-semibold uppercase tracking-wider text-muted-foreground'

  switch (step.type) {
    case 'wait':
      return (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className={labelClass}>Quantidade</Label>
            <Input type="number" min={1} value={step.config.amount ?? 1}
              onChange={e => patch({ amount: parseInt(e.target.value) || 1 })} />
          </div>
          <div className="space-y-2">
            <Label className={labelClass}>Unidade</Label>
            <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={step.config.unit || 'minutes'} onChange={e => patch({ unit: e.target.value })}>
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
          <Label className={labelClass}>Template ID</Label>
          <Input placeholder="ID do template de e-mail" value={step.config.templateId || ''}
            onChange={e => patch({ templateId: e.target.value })} />
          <p className="text-xs text-muted-foreground">Cole o ID do template criado em Templates.</p>
        </div>
      )
    case 'send_whatsapp':
      return (
        <div className="space-y-2">
          <Label className={labelClass}>Nome do template HSM</Label>
          <Input placeholder="boas_vindas_v1" value={step.config.templateName || ''}
            onChange={e => patch({ templateName: e.target.value })} />
          <p className="text-xs text-muted-foreground">Nome aprovado no Meta Business Manager.</p>
        </div>
      )
    case 'create_task':
      return (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label className={labelClass}>Título da tarefa</Label>
            <Input placeholder="Ex: Ligar para o lead" value={step.config.title || ''}
              onChange={e => patch({ title: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className={labelClass}>Prazo (dias)</Label>
              <Input type="number" min={1} value={step.config.dueInDays ?? 1}
                onChange={e => patch({ dueInDays: parseInt(e.target.value) || 1 })} />
            </div>
            <div className="space-y-2">
              <Label className={labelClass}>Prioridade</Label>
              <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={step.config.priority || 'normal'} onChange={e => patch({ priority: e.target.value })}>
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
          <Label className={labelClass}>Mover para</Label>
          <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            value={step.config.stageId || ''} onChange={e => patch({ stageId: e.target.value })}>
            <option value="">Selecione...</option>
            {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )
    case 'add_tag':
      return (
        <div className="space-y-2">
          <Label className={labelClass}>Nome da tag</Label>
          <Input placeholder="Ex: VIP" value={step.config.tag || ''}
            onChange={e => patch({ tag: e.target.value })} />
        </div>
      )
    case 'send_push':
      return (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label className={labelClass}>Título</Label>
            <Input placeholder="Ex: Novo lead no funil" value={step.config.title || ''}
              onChange={e => patch({ title: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label className={labelClass}>Mensagem</Label>
            <Input placeholder="{{lead.name}} entrou no estágio {{stage}}" value={step.config.body || ''}
              onChange={e => patch({ body: e.target.value })} />
            <p className="text-xs text-muted-foreground">
              Variáveis: <code className="bg-muted px-1 rounded">{'{{lead.name}}'}</code>{' '}
              <code className="bg-muted px-1 rounded">{'{{lead.email}}'}</code>
            </p>
          </div>
        </div>
      )
    case 'webhook':
      return (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label className={labelClass}>URL</Label>
            <Input type="url" placeholder="https://hooks.exemplo.com/notify" value={step.config.url || ''}
              onChange={e => patch({ url: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label className={labelClass}>Método</Label>
            <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={step.config.method || 'POST'} onChange={e => patch({ method: e.target.value })}>
              <option value="POST">POST</option>
              <option value="GET">GET</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label className={labelClass}>Headers extras (JSON)</Label>
            <Input placeholder={'{"Authorization": "Bearer token"}'} value={step.config.headers || ''}
              onChange={e => patch({ headers: e.target.value })} />
          </div>
        </div>
      )
    default:
      return null
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AutomationFlow({ auto, setAuto, forms, stages }: Props) {
  const [selected, setSelected] = useState<SelectedNode>(null)

  const steps: Step[] = auto.steps || []

  function setSteps(next: Step[]) {
    setAuto({ ...auto, steps: next })
  }

  function insertStep(atIndex: number, type: string) {
    const newStep: Step = { id: `step_${Date.now()}`, type, config: {} }
    if (type === 'wait')        newStep.config = { amount: 1, unit: 'minutes' }
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

  const selectedStep = selected?.kind === 'step' && steps[selected.index] ? steps[selected.index] : null
  const selectedStepMeta = selectedStep ? stepMeta(selectedStep.type) : null
  const panelOpen = !!selected

  return (
    <div className="flex h-full overflow-hidden bg-muted/20">

      {/* ── Left config panel ─────────────────────────────────────────────── */}
      <div
        className={cn(
          'shrink-0 border-r border-border bg-card overflow-y-auto transition-all duration-200 ease-out',
          panelOpen ? 'w-[300px] opacity-100' : 'w-0 opacity-0 pointer-events-none',
        )}
      >
        {panelOpen && (
          <div className="p-5">
            {/* Panel header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                {selected?.kind === 'trigger' ? (
                  <>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${TRIGGER_COLOR}20`, color: TRIGGER_COLOR }}>
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: TRIGGER_COLOR }}>Gatilho</p>
                      <p className="text-sm font-semibold leading-tight">{triggerMeta(auto.trigger_type).label}</p>
                    </div>
                  </>
                ) : selectedStepMeta ? (
                  <>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${selectedStepMeta.color}20`, color: selectedStepMeta.color }}>
                      <selectedStepMeta.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: selectedStepMeta.color }}>
                        Passo {(selected as any).index + 1}
                      </p>
                      <p className="text-sm font-semibold leading-tight">{selectedStepMeta.label}</p>
                    </div>
                  </>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="border-b border-border mb-5" />

            {/* Config form */}
            {selected?.kind === 'trigger' && (
              <TriggerConfig auto={auto} setAuto={setAuto} forms={forms} stages={stages} />
            )}
            {selected?.kind === 'step' && selectedStep && (
              <>
                <StepConfig
                  step={selectedStep}
                  index={(selected as any).index}
                  steps={steps}
                  setSteps={setSteps}
                  stages={stages}
                />
                <div className="mt-6 pt-4 border-t border-border">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10 w-full justify-start"
                    onClick={() => removeStep((selected as any).index)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> Remover passo
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Canvas ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto relative">
        {/* Dot grid */}
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            color: 'hsl(var(--border))',
          }}
        />

        {/* Flow */}
        <div className="relative flex flex-col items-center py-12 px-8 min-h-full">

          {/* Trigger node */}
          <FlowNode
            icon={Zap}
            color={TRIGGER_COLOR}
            typeLabel="Gatilho"
            nodeName={triggerMeta(auto.trigger_type).label}
            detail={describeTrigger(auto.trigger_type, auto.trigger_config, forms, stages)}
            badge="Início"
            isSelected={selected?.kind === 'trigger'}
            onClick={() => setSelected({ kind: 'trigger' })}
          />

          {/* Connector before first step */}
          <Connector onSelect={t => insertStep(0, t)} />

          {/* Step nodes */}
          {steps.map((step, i) => {
            const meta = stepMeta(step.type)
            return (
              <div key={step.id || i} className="flex flex-col items-center">
                <FlowNode
                  icon={meta.icon}
                  color={meta.color}
                  typeLabel={meta.label}
                  nodeName={meta.label}
                  detail={describeStep(step, stages)}
                  badge={`Passo ${i + 1}`}
                  isSelected={selected?.kind === 'step' && selected.index === i}
                  onClick={() => setSelected({ kind: 'step', index: i })}
                  onDelete={() => removeStep(i)}
                />
                <Connector onSelect={t => insertStep(i + 1, t)} />
              </div>
            )
          })}

          {/* End marker */}
          <div className="flex flex-col items-center gap-1 mt-1 text-muted-foreground/50">
            <div className="w-9 h-9 rounded-full border-2 border-dashed border-border flex items-center justify-center">
              <ChevronDown className="w-4 h-4" />
            </div>
            <span className="text-[10px] uppercase tracking-wider font-medium">Fim do fluxo</span>
          </div>

        </div>
      </div>
    </div>
  )
}
