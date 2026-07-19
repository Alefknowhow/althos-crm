'use client'

/**
 * AutomationFlow — visual canvas editor (vertical layout, left config panel).
 *
 * Same data model as before (trigger + linear steps array). Pure visual
 * redesign: nodes stacked vertically with connectors, left-side config panel
 * that slides in when a node is clicked, richer node cards.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
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
  GripVertical,
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
  { id: 'customer.birthday',   label: 'Aniversário do Cliente',   desc: 'Dispara no aniversário do cliente (verificação diária às 7h)' },
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

type StepStat = { success: number; errors: number }

type WaTemplate = {
  id: string
  name: string
  display_name: string
  body_text: string
  variable_names: string[] | null
  header_type: string
  header_media_url: string | null
  language: string
}

type Props = {
  auto: any
  setAuto: (next: any) => void
  forms: Array<{ id: string; name: string }>
  stages: Array<{ id: string; name: string }>
  stepStats?: Record<number, StepStat>
  whatsappTemplates?: WaTemplate[]
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
  if (type === 'customer.birthday')  return 'No aniversário do cliente'
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
  stats,
  config,
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
  stats?: StepStat
  /** Always-visible inline config fields rendered inside the card. */
  config?: React.ReactNode
}) {
  return (
    <div className="relative group/node">
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        className={cn(
          'w-[260px] bg-card border rounded-none   text-left transition-all duration-150',
          isSelected
            ? 'ring-2 ring-primary border-primary  '
            : '  hover:border-primary/40',
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

        {/* Title */}
        <div className="px-3 pb-2 border-t border-border/40 pt-2">
          <p className="text-sm font-semibold leading-tight">{nodeName}</p>
          {!config && <p className="text-xs text-muted-foreground leading-relaxed mt-1">{detail}</p>}
        </div>

        {/* Always-visible inline config fields */}
        {config && (
          <div
            className="px-3 pb-3 pt-1 space-y-2.5"
            // Stop drag from starting when interacting with the fields; the
            // canvas drag handler already bails on inputs, but this keeps any
            // stray pointer events inside the config from bubbling up.
            onPointerDown={e => e.stopPropagation()}
          >
            {config}
          </div>
        )}

        {/* Footer — show step counters only when stats prop is present (i.e. not the trigger node) */}
        {stats !== undefined ? (
          <div className="px-3 py-2 border-t border-border/30 bg-muted/30 rounded-b-xl grid grid-cols-3 divide-x divide-border/40">
            <div className="flex flex-col items-center gap-0.5 pr-1">
              <span className={cn('text-[11px] font-bold tabular-nums', stats.success > 0 ? 'text-emerald-500' : 'text-muted-foreground/40')}>
                {stats.success}
              </span>
              <span className="text-[8px] uppercase tracking-wide text-muted-foreground/50">Sucessos</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 px-1">
              <span className="text-[11px] font-bold tabular-nums text-muted-foreground/40">0</span>
              <span className="text-[8px] uppercase tracking-wide text-muted-foreground/50">Alertas</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 pl-1">
              <span className={cn('text-[11px] font-bold tabular-nums', stats.errors > 0 ? 'text-red-500' : 'text-muted-foreground/40')}>
                {stats.errors}
              </span>
              <span className="text-[8px] uppercase tracking-wide text-muted-foreground/50">Erros</span>
            </div>
          </div>
        ) : (
          <div className="px-3 py-2 border-t border-border/30 bg-muted/30 rounded-b-xl">
            <p className="text-[10px] text-muted-foreground/50 font-medium text-center">Início do fluxo</p>
          </div>
        )}
      </div>

      {/* Delete button */}
      {onDelete && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onDelete() }}
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover/node:opacity-100 transition-opacity flex items-center justify-center   z-10"
          title="Remover passo"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}

// ── Measure wrapper ────────────────────────────────────────────────────────────
// Reports its rendered height up via ResizeObserver so the connector math can
// follow variable node heights (inline config makes cards taller/shorter).
function Measure({
  id,
  onMeasure,
  children,
  ...rest
}: {
  id: string
  onMeasure: (id: string, h: number) => void
} & React.HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const report = () => onMeasure(id, el.offsetHeight)
    report()
    const ro = new ResizeObserver(report)
    ro.observe(el)
    return () => ro.disconnect()
  }, [id, onMeasure])
  return <div ref={ref} {...rest}>{children}</div>
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

function StepConfig({
  step, index, steps, setSteps, stages, whatsappTemplates,
}: {
  step: Step
  index: number
  steps: Step[]
  setSteps: (s: Step[]) => void
  stages: Props['stages']
  whatsappTemplates?: WaTemplate[]
}) {
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
    case 'send_whatsapp': {
      const templates = whatsappTemplates ?? []
      const selectedTpl = templates.find(t => t.name === step.config.templateName) ?? null
      const varNames: string[] = selectedTpl?.variable_names ?? []

      return (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label className={labelClass}>Template HSM</Label>
            {templates.length > 0 ? (
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={step.config.templateName || ''}
                onChange={e => {
                  const tpl = templates.find(t => t.name === e.target.value) ?? null
                  patch({
                    templateName:   e.target.value,
                    templateId:     tpl?.id ?? '',
                    language:       tpl?.language ?? 'pt_BR',
                    headerType:     tpl?.header_type ?? 'none',
                    headerMediaUrl: tpl?.header_media_url ?? '',
                    variables:      tpl?.variable_names ? tpl.variable_names.map(() => '') : [],
                  })
                }}
              >
                <option value="">Selecione um template…</option>
                {templates.map(t => (
                  <option key={t.id} value={t.name}>{t.display_name} ({t.name})</option>
                ))}
              </select>
            ) : (
              <>
                <Input
                  placeholder="boas_vindas_v1"
                  value={step.config.templateName || ''}
                  onChange={e => patch({ templateName: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Crie templates em <strong>Operações › Templates WA</strong> para selecionar aqui.
                </p>
              </>
            )}
          </div>

          {/* Preview do template selecionado */}
          {selectedTpl && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-xs space-y-1">
              <p className="font-semibold text-emerald-800 leading-tight">{selectedTpl.display_name}</p>
              <p className="text-emerald-700 leading-relaxed line-clamp-3">{selectedTpl.body_text}</p>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {selectedTpl.header_type !== 'none' && (
                  <span className="inline-block bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full text-[10px] font-medium uppercase">
                    Header: {selectedTpl.header_type}
                  </span>
                )}
                <span className="inline-block bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full text-[10px] font-medium">
                  {selectedTpl.language}
                </span>
              </div>
            </div>
          )}

          {/* Variable value inputs */}
          {varNames.map((varName, idx) => (
            <div key={idx} className="space-y-1.5">
              <Label className={labelClass}>
                {`{{${idx + 1}}}`} — {varName}
              </Label>
              <Input
                placeholder={`Valor para ${varName}`}
                value={(step.config.variables ?? [])[idx] ?? ''}
                onChange={e => {
                  const vars = [...(step.config.variables ?? Array(varNames.length).fill(''))] as string[]
                  vars[idx] = e.target.value
                  patch({ variables: vars })
                }}
              />
            </div>
          ))}

          {step.config.templateName && (
            <p className="text-[10px] text-muted-foreground">
              Nome Meta: <code className="bg-muted px-1 rounded">{step.config.templateName}</code>
              {' · '}Idioma: <strong>{step.config.language || 'pt_BR'}</strong>
            </p>
          )}
        </div>
      )
    }
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

// ── Canvas constants ──────────────────────────────────────────────────────────

const NODE_W  = 260
const NODE_H  = 172  // fallback node height before a card is measured
const H_GAP   = 80   // horizontal gap between nodes in default layout
// Default horizontal step for the initial auto-layout. Ports live on the node
// sides, so the flow reads left → right.
const LAYOUT_H_STEP = NODE_W + H_GAP
const LAYOUT_BASE_X = 40
const LAYOUT_BASE_Y = 60
const TRIGGER_ID = '__trigger'

type Edge = { source: string; target: string }

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AutomationFlow({ auto, setAuto, forms, stages, stepStats, whatsappTemplates }: Props) {
  const [selected, setSelected] = useState<SelectedNode>(null)

  // Free-drag canvas state
  const canvasRef  = useRef<HTMLDivElement>(null)
  const [nodePos, setNodePos] = useState<Record<string, { x: number; y: number }>>({})

  // Measured node heights (inline config makes cards variable-height). The
  // connector/edge math reads these instead of the old fixed NODE_H constant.
  const [nodeHeights, setNodeHeights] = useState<Record<string, number>>({})
  const onMeasure = useCallback((id: string, h: number) => {
    setNodeHeights(prev => (prev[id] === h ? prev : { ...prev, [id]: h }))
  }, [])
  const heightOf = (id: string) => nodeHeights[id] ?? NODE_H
  const dragRef    = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number } | null>(null)
  const lastPosRef = useRef<{ x: number; y: number } | null>(null)
  const didDrag    = useRef(false)

  // Drag-to-connect state (N8N-style). `conn` holds the in-progress connection
  // originating from a node's output port, following the cursor in canvas coords.
  const [conn, setConn] = useState<{ source: string; x: number; y: number } | null>(null)

  const steps: Step[] = auto.steps || []
  const stepId = (s: Step, i: number) => s.id || `s${i}`

  // Ensure every step has a stable id (edges reference ids). Runs once on mount.
  useEffect(() => {
    if (steps.some(s => !s.id)) {
      const base = Date.now()
      const fixed = steps.map((s, i) => (s.id ? s : { ...s, id: `step_${base}_${i}` }))
      setAuto({ ...auto, steps: fixed })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Build ordered node ID list: trigger first, then each step
  const allIds = [TRIGGER_ID, ...steps.map((s, i) => stepId(s, i))]

  // Edges: source of truth lives in trigger_config.__edges. When absent we
  // fall back to a linear chain derived from the current step order so existing
  // automations keep working unchanged.
  const edges: Edge[] = useMemo(() => {
    const stored = auto.trigger_config?.__edges
    if (Array.isArray(stored)) return stored as Edge[]
    const ids = [TRIGGER_ID, ...steps.map((s, i) => stepId(s, i))]
    const e: Edge[] = []
    for (let i = 0; i < ids.length - 1; i++) e.push({ source: ids[i], target: ids[i + 1] })
    return e
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto.trigger_config?.__edges, steps])

  const nextOf = (id: string, es: Edge[] = edges) => es.find(e => e.source === id)?.target
  const incomingOf = (id: string, es: Edge[] = edges) => es.find(e => e.target === id)?.source

  // Initialise positions once canvas is mounted or when steps change
  const initPositions = useCallback(() => {
    setNodePos(prev => {
      const next = { ...prev }
      if (!next[TRIGGER_ID]) next[TRIGGER_ID] = auto.trigger_config?.__pos ?? { x: LAYOUT_BASE_X, y: LAYOUT_BASE_Y }
      steps.forEach((s, i) => {
        const id = stepId(s, i)
        if (!next[id]) next[id] = s.config?.__pos ?? { x: LAYOUT_BASE_X + (i + 1) * LAYOUT_H_STEP, y: LAYOUT_BASE_Y }
      })
      const validIds = new Set(allIds)
      Object.keys(next).forEach(k => { if (!validIds.has(k)) delete next[k] })
      return next
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps.length, steps.map(s => s.id).join(',')])

  useEffect(() => { initPositions() }, [initPositions])

  function getPos(id: string, fallbackIndex: number): { x: number; y: number } {
    return nodePos[id] ?? {
      x: LAYOUT_BASE_X + fallbackIndex * LAYOUT_H_STEP,
      y: LAYOUT_BASE_Y,
    }
  }
  const posOf = (id: string) => getPos(id, Math.max(0, allIds.indexOf(id)))

  // ── Node drag handlers (window-level for robustness) ─────────────────────────
  // The card itself is a <button>, so we must NOT bail on generic buttons —
  // only on form controls and the connection ports. Movement vs. click is
  // distinguished via the didDrag threshold so a plain click still selects.
  function onDragStart(e: React.PointerEvent, nodeId: string, fallbackIndex: number) {
    if ((e.target as HTMLElement).closest('select,input,textarea,a,[role="menuitem"],[data-port]')) return

    const p = getPos(nodeId, fallbackIndex)
    dragRef.current  = { id: nodeId, sx: e.clientX, sy: e.clientY, ox: p.x, oy: p.y }
    lastPosRef.current = p
    didDrag.current  = false

    const move = (ev: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      const dx = ev.clientX - d.sx
      const dy = ev.clientY - d.sy
      if (Math.abs(dx) + Math.abs(dy) > 3) didDrag.current = true
      const pos = { x: d.ox + dx, y: d.oy + dy }
      lastPosRef.current = pos
      setNodePos(prev => ({ ...prev, [d.id]: pos }))
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      const d = dragRef.current
      dragRef.current = null
      if (!d || !didDrag.current || !lastPosRef.current) return
      const pos = lastPosRef.current
      if (d.id === TRIGGER_ID) {
        setAuto({ ...auto, trigger_config: { ...(auto.trigger_config || {}), __pos: pos } })
      } else {
        const next = steps.map((s, i) => (stepId(s, i) === d.id ? { ...s, config: { ...(s.config || {}), __pos: pos } } : s))
        setAuto({ ...auto, steps: next })
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  function wasDrag() { return didDrag.current }

  // ── Graph persistence ────────────────────────────────────────────────────────
  // Persists edges into trigger_config.__edges AND reorders steps[] to match the
  // chain (trigger → … → end) so the linear runtime executes in the drawn order.
  // Orphan steps (not reachable from the trigger) are appended at the end.
  function persistGraph(newEdges: Edge[], newSteps: Step[] = steps) {
    const byId = new Map(newSteps.map((s, i) => [stepId(s, i), s]))
    const ordered: Step[] = []
    const visited = new Set<string>()
    let cur = newEdges.find(e => e.source === TRIGGER_ID)?.target
    let guard = 0
    while (cur && byId.has(cur) && !visited.has(cur) && guard++ < 1000) {
      visited.add(cur)
      ordered.push(byId.get(cur)!)
      cur = newEdges.find(e => e.source === cur)?.target
    }
    byId.forEach((s, id) => { if (!visited.has(id)) ordered.push(s) })
    setAuto({
      ...auto,
      steps: ordered,
      trigger_config: { ...(auto.trigger_config || {}), __edges: newEdges },
    })
  }

  // True if following outgoing edges from `from` eventually reaches `goal`.
  function reaches(es: Edge[], from: string | undefined, goal: string) {
    let cur = from, guard = 0
    while (cur && guard++ < 1000) {
      if (cur === goal) return true
      cur = es.find(e => e.source === cur)?.target
    }
    return false
  }

  // ── Connection actions ───────────────────────────────────────────────────────
  function connect(source: string, target: string) {
    if (!target || target === TRIGGER_ID || source === target) return
    // Single-chain (Fase A): a node has at most one outgoing + one incoming edge.
    const filtered = edges.filter(e => e.source !== source && e.target !== target)
    if (reaches(filtered, target, source)) return // would create a cycle
    persistGraph([...filtered, { source, target }])
  }

  function removeEdge(source: string, target: string) {
    persistGraph(edges.filter(e => !(e.source === source && e.target === target)))
  }

  function setSteps(next: Step[]) { setAuto({ ...auto, steps: next }) }

  // Insert a new step right after `afterNodeId`, rewiring edges:
  //   afterNode → T   becomes   afterNode → new → T
  function insertStep(afterNodeId: string, type: string) {
    const newId = `step_${Date.now()}`
    const afterPos = posOf(afterNodeId)
    const newStep: Step = { id: newId, type, config: { __pos: { x: afterPos.x + LAYOUT_H_STEP, y: afterPos.y } } }
    if (type === 'wait')        newStep.config = { ...newStep.config, amount: 1, unit: 'minutes' }
    if (type === 'create_task') newStep.config = { ...newStep.config, title: 'Nova Tarefa', priority: 'normal', dueInDays: 1 }

    const out = edges.find(e => e.source === afterNodeId)
    const rewired = edges.filter(e => e.source !== afterNodeId)
    rewired.push({ source: afterNodeId, target: newId })
    if (out) rewired.push({ source: newId, target: out.target })

    setNodePos(prev => ({ ...prev, [newId]: newStep.config!.__pos }))
    persistGraph(rewired, [...steps, newStep])
  }

  // Remove a step, healing the chain:  X → node → Y   becomes   X → Y
  function removeStep(index: number) {
    const id = stepId(steps[index], index)
    const inc = incomingOf(id)
    const out = nextOf(id)
    let rewired = edges.filter(e => e.source !== id && e.target !== id)
    if (inc && out) rewired = [...rewired, { source: inc, target: out }]
    persistGraph(rewired, steps.filter((_, i) => i !== index))
    if (selected?.kind === 'step' && selected.index === index) setSelected(null)
  }

  // ── Port (drag-to-connect) handlers ──────────────────────────────────────────
  function canvasCoords(clientX: number, clientY: number) {
    const rect = canvasRef.current?.getBoundingClientRect()
    return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) }
  }
  function onPortDown(e: React.PointerEvent, sourceId: string) {
    e.preventDefault()
    e.stopPropagation()
    const c = canvasCoords(e.clientX, e.clientY)
    setConn({ source: sourceId, x: c.x, y: c.y })
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  function onPortMove(e: React.PointerEvent) {
    if (!conn) return
    const c = canvasCoords(e.clientX, e.clientY)
    setConn(prev => (prev ? { ...prev, x: c.x, y: c.y } : prev))
  }
  function onPortUp(e: React.PointerEvent) {
    if (!conn) return
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
    const targetEl = el?.closest('[data-node-id]') as HTMLElement | null
    const targetId = targetEl?.getAttribute('data-node-id')
    if (targetId) connect(conn.source, targetId)
    setConn(null)
  }

  // Tail of the chain (last node reachable from the trigger) — gets the "+" below.
  const chainTail = (() => {
    let cur = TRIGGER_ID, guard = 0
    while (guard++ < 1000) { const n = nextOf(cur); if (!n) break; cur = n }
    return cur
  })()

  // Canvas bounding box: large enough to contain all nodes
  const canvasMinH = Math.max(
    600,
    ...allIds.map(id => posOf(id).y + heightOf(id) + 80),
  )
  // Nodes now flow horizontally, so the canvas must also grow wide enough to
  // scroll to the rightmost node (plus room for its output port + the tail "+").
  const canvasMinW = Math.max(
    canvasRef.current?.clientWidth ?? 600,
    ...allIds.map(id => posOf(id).x + NODE_W + 120),
  )

  return (
    <div className="flex h-full overflow-hidden bg-muted/20">

      {/* ── Free-drag canvas (config now lives inline in each node) ────────── */}
      <div className="flex-1 overflow-auto relative select-none">
        {/* Dot-grid background */}
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            color: 'hsl(var(--border))',
          }}
        />

        {/* Inner canvas — grows to fit all nodes */}
        <div ref={canvasRef} className="relative w-full" style={{ minHeight: canvasMinH, minWidth: canvasMinW }}>

          {/* ── SVG connector lines (from the edge graph) ─────────────────── */}
          <svg className="absolute inset-0 pointer-events-none overflow-visible" style={{ width: canvasMinW, height: canvasMinH }}>
            <defs>
              <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="4" refY="3" orient="auto">
                <path d="M0,0 L0,6 L7,3 z" fill="hsl(var(--border))" opacity="0.7" />
              </marker>
            </defs>
            {edges.map(edge => {
              const from = posOf(edge.source)
              const to   = posOf(edge.target)
              // Exit the right side of the source, enter the left side of the target.
              const x1 = from.x + NODE_W,  y1 = from.y + heightOf(edge.source) / 2
              const x2 = to.x,             y2 = to.y + heightOf(edge.target) / 2
              const cx = (x1 + x2) / 2
              return (
                <path
                  key={`edge-${edge.source}-${edge.target}`}
                  d={`M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`}
                  stroke="hsl(var(--primary))"
                  strokeWidth="2"
                  fill="none"
                  opacity="0.55"
                  markerEnd="url(#arrowhead)"
                />
              )
            })}
            {/* In-progress connection following the cursor */}
            {conn && (() => {
              const from = posOf(conn.source)
              const x1 = from.x + NODE_W, y1 = from.y + heightOf(conn.source) / 2
              const cx = (x1 + conn.x) / 2
              return (
                <path
                  d={`M${x1},${y1} C${cx},${y1} ${cx},${conn.y} ${conn.x},${conn.y}`}
                  stroke="hsl(var(--primary))"
                  strokeWidth="2"
                  strokeDasharray="5 4"
                  fill="none"
                  opacity="0.8"
                />
              )
            })()}
          </svg>

          {/* ── Trigger node ─────────────────────────────────────────────── */}
          {(() => {
            const pos = posOf(TRIGGER_ID)
            return (
              <Measure
                id={TRIGGER_ID}
                onMeasure={onMeasure}
                data-node-id={TRIGGER_ID}
                className="absolute cursor-grab active:cursor-grabbing"
                style={{ left: pos.x, top: pos.y, width: NODE_W, touchAction: 'none' }}
                onPointerDown={e => onDragStart(e, TRIGGER_ID, 0)}
              >
                {/* Drag handle hint */}
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-muted-foreground/30 pointer-events-none">
                  <GripVertical className="w-4 h-4" />
                </div>
                <FlowNode
                  icon={Zap}
                  color={TRIGGER_COLOR}
                  typeLabel="Gatilho"
                  nodeName={triggerMeta(auto.trigger_type).label}
                  detail={describeTrigger(auto.trigger_type, auto.trigger_config, forms, stages)}
                  badge="Início"
                  isSelected={selected?.kind === 'trigger'}
                  onClick={() => { if (!wasDrag()) setSelected({ kind: 'trigger' }) }}
                  config={<TriggerConfig auto={auto} setAuto={setAuto} forms={forms} stages={stages} />}
                />
                {/* Output port (right side) */}
                <button
                  type="button"
                  data-port
                  title="Arraste para conectar"
                  onPointerDown={e => onPortDown(e, TRIGGER_ID)}
                  onPointerMove={onPortMove}
                  onPointerUp={onPortUp}
                  className="absolute top-1/2 -translate-y-1/2 -right-2.5 w-4 h-4 rounded-full border-2 border-primary bg-background hover:bg-primary transition-colors z-20 cursor-crosshair"
                />
              </Measure>
            )
          })()}

          {/* ── Step nodes ───────────────────────────────────────────────── */}
          {steps.map((step, i) => {
            const nodeId = stepId(step, i)
            const pos    = posOf(nodeId)
            const meta   = stepMeta(step.type)
            return (
              <Measure
                key={nodeId}
                id={nodeId}
                onMeasure={onMeasure}
                data-node-id={nodeId}
                className="absolute cursor-grab active:cursor-grabbing"
                style={{ left: pos.x, top: pos.y, width: NODE_W, touchAction: 'none' }}
                onPointerDown={e => onDragStart(e, nodeId, i + 1)}
              >
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-muted-foreground/30 pointer-events-none">
                  <GripVertical className="w-4 h-4" />
                </div>
                {/* Input port (left side, visual drop target) */}
                <div
                  data-port
                  className={cn(
                    'absolute top-1/2 -translate-y-1/2 -left-2.5 w-4 h-4 rounded-full border-2 bg-background z-20 transition-colors',
                    conn && conn.source !== nodeId ? 'border-primary' : 'border-muted-foreground/40',
                  )}
                />
                <FlowNode
                  icon={meta.icon}
                  color={meta.color}
                  typeLabel={meta.label}
                  nodeName={meta.label}
                  detail={describeStep(step, stages)}
                  badge={`Passo ${i + 1}`}
                  isSelected={selected?.kind === 'step' && selected.index === i}
                  onClick={() => { if (!wasDrag()) setSelected({ kind: 'step', index: i }) }}
                  onDelete={() => removeStep(i)}
                  stats={stepStats?.[i] ?? { success: 0, errors: 0 }}
                  config={<StepConfig step={step} index={i} steps={steps} setSteps={setSteps} stages={stages} whatsappTemplates={whatsappTemplates} />}
                />
                {/* Output port (right side) */}
                <button
                  type="button"
                  data-port
                  title="Arraste para conectar"
                  onPointerDown={e => onPortDown(e, nodeId)}
                  onPointerMove={onPortMove}
                  onPointerUp={onPortUp}
                  className="absolute top-1/2 -translate-y-1/2 -right-2.5 w-4 h-4 rounded-full border-2 border-primary bg-background hover:bg-primary transition-colors z-20 cursor-crosshair"
                />
              </Measure>
            )
          })}

          {/* ── Per-edge midpoint controls: insert (+) and delete (✕) ──────── */}
          {edges.map(edge => {
            const from = posOf(edge.source)
            const to   = posOf(edge.target)
            const mx   = (from.x + NODE_W + to.x) / 2
            const my   = (from.y + heightOf(edge.source) / 2 + to.y + heightOf(edge.target) / 2) / 2
            return (
              <div
                key={`mid-${edge.source}-${edge.target}`}
                className="absolute z-20 flex items-center gap-1 opacity-40 hover:opacity-100 transition-opacity"
                style={{ left: mx - 22, top: my - 14 }}
              >
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      title="Inserir passo aqui"
                      className="w-7 h-7 rounded-full border-2 border-border bg-background text-muted-foreground hover:border-primary hover:bg-primary hover:text-primary-foreground transition-all flex items-center justify-center  "
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="bottom" align="start" collisionPadding={12} className="w-52 max-h-[60vh] overflow-y-auto">
                    <DropdownMenuLabel className="text-xs">Inserir passo</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {STEP_TYPES.map(t => (
                      <DropdownMenuItem key={t.id} onClick={() => insertStep(edge.source, t.id)}>
                        <t.icon className="w-4 h-4 mr-2 shrink-0" style={{ color: t.color }} />
                        <span className="text-sm">{t.label}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <button
                  type="button"
                  title="Remover conexão"
                  onClick={() => removeEdge(edge.source, edge.target)}
                  className="w-6 h-6 rounded-full border-2 border-border bg-background text-muted-foreground hover:border-destructive hover:bg-destructive hover:text-destructive-foreground transition-all flex items-center justify-center  "
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )
          })}

          {/* ── "+" after the chain tail ─────────────────────────────────── */}
          {(() => {
            const tailPos = posOf(chainTail)
            const bx      = tailPos.x + NODE_W + 22
            const by      = tailPos.y + heightOf(chainTail) / 2 - 14
            return (
              <div className="absolute z-20" style={{ left: bx, top: by }}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      title="Adicionar passo"
                      className="w-7 h-7 rounded-full border-2 border-border bg-background text-muted-foreground hover:border-primary hover:bg-primary hover:text-primary-foreground transition-all flex items-center justify-center  "
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="bottom" align="start" collisionPadding={12} className="w-52 max-h-[60vh] overflow-y-auto">
                    <DropdownMenuLabel className="text-xs">Adicionar passo</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {STEP_TYPES.map(t => (
                      <DropdownMenuItem key={t.id} onClick={() => insertStep(chainTail, t.id)}>
                        <t.icon className="w-4 h-4 mr-2 shrink-0" style={{ color: t.color }} />
                        <span className="text-sm">{t.label}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )
          })()}

        </div>
      </div>
    </div>
  )
}
