'use client'

/**
 * AutomationFlow — visual canvas editor (vertical layout, left config panel).
 *
 * Same data model as before (trigger + linear steps array). Pure visual
 * redesign: nodes stacked vertically with connectors, left-side config panel
 * that slides in when a node is clicked, richer node cards.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
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

        {/* Footer — show step counters only when stats prop is present (i.e. not the trigger node) */}
        {stats !== undefined ? (
          <div className="px-3 py-2 mt-1 border-t border-border/30 bg-muted/30 rounded-b-xl grid grid-cols-3 divide-x divide-border/40">
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
          <div className="px-3 py-2 mt-1 border-t border-border/30 bg-muted/30 rounded-b-xl">
            <p className="text-[10px] text-muted-foreground/50 font-medium text-center">Início do fluxo</p>
          </div>
        )}
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
const NODE_H  = 172  // approximate node height (strip+header+body+footer)
const V_GAP   = 52   // vertical gap between nodes in default layout

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AutomationFlow({ auto, setAuto, forms, stages, stepStats, whatsappTemplates }: Props) {
  const [selected, setSelected] = useState<SelectedNode>(null)

  // Free-drag canvas state
  const canvasRef  = useRef<HTMLDivElement>(null)
  const [nodePos, setNodePos] = useState<Record<string, { x: number; y: number }>>({})
  const dragRef    = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number } | null>(null)
  const didDrag    = useRef(false)

  const steps: Step[] = auto.steps || []

  // Build ordered node ID list: trigger first, then each step
  const allIds = ['__trigger', ...steps.map(s => s.id || `s${steps.indexOf(s)}`)]

  // Initialise positions once canvas is mounted or when steps change
  const initPositions = useCallback(() => {
    const cw = canvasRef.current?.clientWidth ?? 600
    const cx = Math.max(20, (cw - NODE_W) / 2)
    setNodePos(prev => {
      const next = { ...prev }
      // Trigger — restore a previously saved position if present.
      if (!next['__trigger']) next['__trigger'] = auto.trigger_config?.__pos ?? { x: cx, y: 30 }
      // Steps — only add missing ones, restoring saved positions when available.
      steps.forEach((s, i) => {
        const id = s.id || `s${i}`
        if (!next[id]) next[id] = s.config?.__pos ?? { x: cx, y: 30 + (i + 1) * (NODE_H + V_GAP) }
      })
      // Remove positions for deleted steps
      const validIds = new Set(allIds)
      Object.keys(next).forEach(k => { if (!validIds.has(k)) delete next[k] })
      return next
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps.length, steps.map(s => s.id).join(',')])

  useEffect(() => { initPositions() }, [initPositions])

  function getPos(id: string, fallbackIndex: number): { x: number; y: number } {
    return nodePos[id] ?? {
      x: Math.max(20, ((canvasRef.current?.clientWidth ?? 600) - NODE_W) / 2),
      y: 30 + fallbackIndex * (NODE_H + V_GAP),
    }
  }

  // Drag handlers
  function onDragStart(e: React.PointerEvent, nodeId: string, fallbackIndex: number) {
    // Don't start drag when clicking interactive elements inside the card
    if ((e.target as HTMLElement).closest('button,select,input,a,[role="menuitem"]')) return
    e.preventDefault()
    e.stopPropagation()
    const p = getPos(nodeId, fallbackIndex)
    dragRef.current  = { id: nodeId, sx: e.clientX, sy: e.clientY, ox: p.x, oy: p.y }
    didDrag.current  = false
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onDragMove(e: React.PointerEvent, nodeId: string) {
    if (dragRef.current?.id !== nodeId) return
    const { sx, sy, ox, oy } = dragRef.current
    const dx = e.clientX - sx
    const dy = e.clientY - sy
    if (Math.abs(dx) + Math.abs(dy) > 3) didDrag.current = true
    setNodePos(prev => ({ ...prev, [nodeId]: { x: ox + dx, y: oy + dy } }))
  }

  function onDragEnd(nodeId?: string) {
    const dragged = didDrag.current && !!dragRef.current
    dragRef.current = null
    // Only persist when an actual drag happened (not a plain click/select).
    if (!dragged || !nodeId) return
    const pos = nodePos[nodeId]
    if (!pos) return
    if (nodeId === '__trigger') {
      setAuto({ ...auto, trigger_config: { ...(auto.trigger_config || {}), __pos: pos } })
    } else {
      const next = steps.map((s, i) => {
        const id = s.id || `s${i}`
        return id === nodeId ? { ...s, config: { ...(s.config || {}), __pos: pos } } : s
      })
      setAuto({ ...auto, steps: next })
    }
  }

  // Returns true if the last pointer interaction was a real drag (suppress click)
  function wasDrag() { return didDrag.current }

  function setSteps(next: Step[]) { setAuto({ ...auto, steps: next }) }

  function insertStep(atIndex: number, type: string) {
    const newStep: Step = { id: `step_${Date.now()}`, type, config: {} }
    if (type === 'wait')        newStep.config = { amount: 1, unit: 'minutes' }
    if (type === 'create_task') newStep.config = { title: 'Nova Tarefa', priority: 'normal', dueInDays: 1 }
    const next = [...steps]
    next.splice(atIndex, 0, newStep)
    setSteps(next)
    // Position new node below current lowest node
    const maxY = Object.values(nodePos).reduce((m, p) => Math.max(m, p.y), 0)
    setNodePos(prev => ({ ...prev, [newStep.id]: { x: getPos('__trigger', 0).x, y: maxY + NODE_H + V_GAP } }))
  }

  function removeStep(index: number) {
    const next = [...steps]
    next.splice(index, 1)
    setSteps(next)
    if (selected?.kind === 'step' && selected.index === index) setSelected(null)
  }

  const selectedStep     = selected?.kind === 'step' && steps[selected.index] ? steps[selected.index] : null
  const selectedStepMeta = selectedStep ? stepMeta(selectedStep.type) : null
  const panelOpen        = !!selected

  // Canvas bounding box: large enough to contain all nodes
  const canvasMinH = Math.max(
    600,
    ...Object.values(nodePos).map(p => p.y + NODE_H + 80),
  )

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
              <button type="button" onClick={() => setSelected(null)} className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="border-b border-border mb-5" />
            {selected?.kind === 'trigger' && <TriggerConfig auto={auto} setAuto={setAuto} forms={forms} stages={stages} />}
            {selected?.kind === 'step' && selectedStep && (
              <>
                <StepConfig step={selectedStep} index={(selected as any).index} steps={steps} setSteps={setSteps} stages={stages} whatsappTemplates={whatsappTemplates} />
                <div className="mt-6 pt-4 border-t border-border">
                  <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 w-full justify-start" onClick={() => removeStep((selected as any).index)}>
                    <Trash2 className="w-4 h-4 mr-2" /> Remover passo
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Free-drag canvas ──────────────────────────────────────────────── */}
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
        <div ref={canvasRef} className="relative w-full" style={{ minHeight: canvasMinH }}>

          {/* ── SVG connector lines ──────────────────────────────────────── */}
          <svg className="absolute inset-0 w-full pointer-events-none overflow-visible" style={{ height: canvasMinH }}>
            <defs>
              <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="4" refY="3" orient="auto">
                <path d="M0,0 L0,6 L7,3 z" fill="hsl(var(--border))" opacity="0.7" />
              </marker>
            </defs>
            {allIds.map((id, idx) => {
              if (idx === allIds.length - 1) return null
              const from = getPos(id, idx)
              const to   = getPos(allIds[idx + 1], idx + 1)
              const x1 = from.x + NODE_W / 2,  y1 = from.y + NODE_H
              const x2 = to.x   + NODE_W / 2,  y2 = to.y
              const cy = (y1 + y2) / 2
              return (
                <path
                  key={`edge-${id}`}
                  d={`M${x1},${y1} C${x1},${cy} ${x2},${cy} ${x2},${y2}`}
                  stroke="hsl(var(--border))"
                  strokeWidth="1.5"
                  fill="none"
                  opacity="0.7"
                  markerEnd="url(#arrowhead)"
                />
              )
            })}
          </svg>

          {/* ── Trigger node ─────────────────────────────────────────────── */}
          {(() => {
            const pos = getPos('__trigger', 0)
            return (
              <div
                className="absolute cursor-grab active:cursor-grabbing"
                style={{ left: pos.x, top: pos.y, width: NODE_W, touchAction: 'none' }}
                onPointerDown={e => onDragStart(e, '__trigger', 0)}
                onPointerMove={e => onDragMove(e, '__trigger')}
                onPointerUp={() => onDragEnd('__trigger')}
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
                />
              </div>
            )
          })()}

          {/* ── Step nodes ───────────────────────────────────────────────── */}
          {steps.map((step, i) => {
            const nodeId = step.id || `s${i}`
            const pos    = getPos(nodeId, i + 1)
            const meta   = stepMeta(step.type)
            return (
              <div
                key={nodeId}
                className="absolute cursor-grab active:cursor-grabbing"
                style={{ left: pos.x, top: pos.y, width: NODE_W, touchAction: 'none' }}
                onPointerDown={e => onDragStart(e, nodeId, i + 1)}
                onPointerMove={e => onDragMove(e, nodeId)}
                onPointerUp={() => onDragEnd(nodeId)}
              >
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-muted-foreground/30 pointer-events-none">
                  <GripVertical className="w-4 h-4" />
                </div>
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
                />
              </div>
            )
          })}

          {/* ── "+" add-step buttons (midpoint of each edge) ─────────────── */}
          {allIds.map((id, idx) => {
            if (idx === allIds.length - 1) return null
            const from  = getPos(id, idx)
            const to    = getPos(allIds[idx + 1], idx + 1)
            const bx    = (from.x + NODE_W / 2 + to.x + NODE_W / 2) / 2 - 14
            const by    = (from.y + NODE_H + to.y) / 2 - 14
            const insertAt = idx  // insert after node idx (trigger=0, step[i]=i+1)
            return (
              <div key={`add-${id}`} className="absolute z-20" style={{ left: bx, top: by }}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      title="Adicionar passo"
                      className="w-7 h-7 rounded-full border-2 border-border bg-background text-muted-foreground hover:border-primary hover:bg-primary hover:text-primary-foreground transition-all flex items-center justify-center shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" className="w-52">
                    <DropdownMenuLabel className="text-xs">Adicionar passo</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {STEP_TYPES.map(t => (
                      <DropdownMenuItem key={t.id} onClick={() => insertStep(insertAt, t.id)}>
                        <t.icon className="w-4 h-4 mr-2 shrink-0" style={{ color: t.color }} />
                        <span className="text-sm">{t.label}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )
          })}

          {/* ── "+" after last node ──────────────────────────────────────── */}
          {(() => {
            const lastId  = allIds[allIds.length - 1]
            const lastPos = getPos(lastId, allIds.length - 1)
            const bx      = lastPos.x + NODE_W / 2 - 14
            const by      = lastPos.y + NODE_H + 20
            return (
              <div className="absolute z-20" style={{ left: bx, top: by }}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      title="Adicionar passo"
                      className="w-7 h-7 rounded-full border-2 border-border bg-background text-muted-foreground hover:border-primary hover:bg-primary hover:text-primary-foreground transition-all flex items-center justify-center shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" className="w-52">
                    <DropdownMenuLabel className="text-xs">Adicionar passo</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {STEP_TYPES.map(t => (
                      <DropdownMenuItem key={t.id} onClick={() => insertStep(steps.length, t.id)}>
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
