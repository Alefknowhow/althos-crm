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

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
  ArrowRight,
  XCircle,
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
  // Vertical Clínicas — sem configuração extra (igual appointment.booked).
  { id: 'clinic.appointment.confirmed', label: 'Agendamento Confirmado (Clínica)', desc: 'Dispara quando o paciente confirma o agendamento' },
  { id: 'clinic.quote.approved',        label: 'Orçamento Aprovado (Clínica)',     desc: 'Dispara quando um orçamento é marcado como aprovado' },
  { id: 'clinic.attendance.completed',  label: 'Atendimento Realizado (Clínica)', desc: 'Dispara quando um atendimento é registrado como realizado' },
  // Vertical Imobiliárias — sem configuração extra (igual appointment.booked).
  { id: 'imoveis.visit.scheduled', label: 'Visita Agendada (Imóveis)',   desc: 'Dispara quando uma visita a um imóvel é agendada' },
  { id: 'imoveis.visit.confirmed', label: 'Visita Confirmada (Imóveis)', desc: 'Dispara quando o lead confirma a visita' },
  { id: 'imoveis.visit.canceled',  label: 'Visita Cancelada (Imóveis)',  desc: 'Dispara quando a visita é cancelada' },
  { id: 'imoveis.visit.completed', label: 'Visita Realizada (Imóveis)',  desc: 'Dispara quando a visita é marcada como realizada' },
  { id: 'imoveis.proposal.sent',   label: 'Proposta Enviada (Imóveis)',  desc: 'Dispara quando uma proposta de imóvel é marcada como enviada' },
  { id: 'imoveis.deal.closed',     label: 'Negócio Fechado (Imóveis)',   desc: 'Dispara quando uma venda ou locação é registrada' },
] as const

const STEP_TYPES = [
  { id: 'send_email',    label: 'Enviar E-mail',    icon: Mail,           color: '#ef4444', desc: 'Envia um template de e-mail para o lead' },
  { id: 'send_whatsapp', label: 'WhatsApp',         icon: MessageSquare,  color: '#10b981', desc: 'Envia uma mensagem via WhatsApp Business' },
  { id: 'create_task',   label: 'Criar Tarefa',     icon: CheckSquare,    color: '#f59e0b', desc: 'Cria uma tarefa vinculada ao lead' },
  { id: 'move_stage',    label: 'Mover Estágio',    icon: ArrowRightLeft, color: '#3b82f6', desc: 'Move o lead para outro estágio do pipeline' },
  { id: 'close_deal',    label: 'Fechar Negociação', icon: XCircle,       color: '#dc2626', desc: 'Marca o lead como perdido ou desqualificado, tirando-o do board' },
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
  if (type === 'clinic.appointment.confirmed') return 'Paciente confirmou o agendamento'
  if (type === 'clinic.quote.approved')        return 'Orçamento aprovado'
  if (type === 'clinic.attendance.completed')  return 'Atendimento registrado como realizado'
  if (type === 'imoveis.visit.scheduled') return 'Nova visita agendada'
  if (type === 'imoveis.visit.confirmed') return 'Lead confirmou a visita'
  if (type === 'imoveis.visit.canceled')  return 'Visita cancelada'
  if (type === 'imoveis.visit.completed') return 'Visita registrada como realizada'
  if (type === 'imoveis.proposal.sent')   return 'Proposta enviada'
  if (type === 'imoveis.deal.closed')     return 'Negócio fechado'
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
    case 'close_deal':    return c.dealStatus === 'desqualificado' ? 'Desqualificado' : 'Perdido'
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
  onDelete?: () => void
  stats?: StepStat
  /** Campos de configuração, sempre visíveis (nunca precisou de seleção/expansão — já era assim no canvas). */
  config?: React.ReactNode
}) {
  return (
    <div className="relative group/node w-[320px] shrink-0">
      <div className="bg-card border rounded-md text-left">
        {/* Colored top strip */}
        <div className="h-1 rounded-t-md w-full" style={{ backgroundColor: color }} />

        {/* Header */}
        <div className="px-3 pt-2.5 pb-2 flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${color}20`, color }}
          >
            <Icon className="w-[15px] h-[15px]" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>
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

        {/* Config fields */}
        {config && <div className="px-3 pb-3 pt-1 space-y-2.5">{config}</div>}

        {/* Footer — contadores de execução (só nos steps, não no trigger) */}
        {stats !== undefined ? (
          <div className="px-3 py-2 border-t border-border/30 bg-muted/30 rounded-b-md grid grid-cols-2 divide-x divide-border/40">
            <div className="flex flex-col items-center gap-0.5 pr-1">
              <span className={cn('text-[11px] font-bold tabular-nums', stats.success > 0 ? 'text-emerald-500' : 'text-muted-foreground/40')}>
                {stats.success}
              </span>
              <span className="text-[8px] uppercase tracking-wide text-muted-foreground/50">Sucessos</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 pl-1">
              <span className={cn('text-[11px] font-bold tabular-nums', stats.errors > 0 ? 'text-red-500' : 'text-muted-foreground/40')}>
                {stats.errors}
              </span>
              <span className="text-[8px] uppercase tracking-wide text-muted-foreground/50">Erros</span>
            </div>
          </div>
        ) : (
          <div className="px-3 py-2 border-t border-border/30 bg-muted/30 rounded-b-md">
            <p className="text-[10px] text-muted-foreground/50 font-medium text-center">Início do fluxo</p>
          </div>
        )}
      </div>

      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover/node:opacity-100 transition-opacity flex items-center justify-center z-10"
          title="Remover passo"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}

// ── Connector — linha vertical + botão de inserir entre dois cards ───────────

function Connector({ onInsert }: { onInsert: (type: string) => void }) {
  return (
    <div className="flex flex-row items-center px-1 shrink-0 self-center">
      <div className="h-px w-3 bg-border" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title="Inserir passo aqui"
            className="w-7 h-7 rounded-full border-2 border-border bg-background text-muted-foreground hover:border-primary hover:bg-primary hover:text-primary-foreground transition-all flex items-center justify-center shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52 max-h-[60vh] overflow-y-auto">
          <DropdownMenuLabel className="text-xs">Inserir passo</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {STEP_TYPES.map(t => (
            <DropdownMenuItem key={t.id} onClick={() => onInsert(t.id)}>
              <t.icon className="w-4 h-4 mr-2 shrink-0" style={{ color: t.color }} />
              <span className="text-sm">{t.label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="h-px w-3 bg-border" />
      <ArrowRight className="w-3.5 h-3.5 text-border -ml-1" />
    </div>
  )
}

// ── Config panel ───────────────────────────────────────────────────────────────

function TriggerConfig({ auto, setAuto, forms, stages }: { auto: any; setAuto: (n: any) => void; forms: Props['forms']; stages: Props['stages'] }) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Evento de disparo</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-input/25 px-3 text-sm"
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
            className="flex h-9 w-full rounded-md border border-input bg-input/25 px-3 text-sm"
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
            className="flex h-9 w-full rounded-md border border-input bg-input/25 px-3 text-sm"
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
            <Select value={step.config.unit || 'minutes'} onValueChange={v => patch({ unit: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="minutes">Minutos</SelectItem>
                <SelectItem value="hours">Horas</SelectItem>
                <SelectItem value="days">Dias</SelectItem>
              </SelectContent>
            </Select>
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
                className="flex h-9 w-full rounded-md border border-input bg-input/25 px-3 text-sm"
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
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 text-xs space-y-1">
              <p className="font-semibold text-emerald-800 dark:text-emerald-300 leading-tight">{selectedTpl.display_name}</p>
              <p className="text-emerald-700 dark:text-emerald-300 leading-relaxed line-clamp-3">{selectedTpl.body_text}</p>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {selectedTpl.header_type !== 'none' && (
                  <span className="inline-block bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-full text-[10px] font-medium uppercase">
                    Header: {selectedTpl.header_type}
                  </span>
                )}
                <span className="inline-block bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-full text-[10px] font-medium">
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
              <Select value={step.config.priority || 'normal'} onValueChange={v => patch({ priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )
    case 'move_stage':
      return (
        <div className="space-y-2">
          <Label className={labelClass}>Mover para</Label>
          <Select value={step.config.stageId || '__none__'} onValueChange={v => patch({ stageId: v === '__none__' ? '' : v })}>
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Selecione...</SelectItem>
              {stages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )
    case 'close_deal':
      return (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label className={labelClass}>Resultado</Label>
            <Select value={step.config.dealStatus || 'perdido'} onValueChange={v => patch({ dealStatus: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="perdido">Perdido</SelectItem>
                <SelectItem value="desqualificado">Desqualificado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className={labelClass}>Motivo</Label>
            <Input placeholder="Ex: Sem resposta" value={step.config.reason || ''}
              onChange={e => patch({ reason: e.target.value })} />
          </div>
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
            <Select value={step.config.method || 'POST'} onValueChange={v => patch({ method: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="GET">GET</SelectItem>
                <SelectItem value="PUT">PUT</SelectItem>
                <SelectItem value="PATCH">PATCH</SelectItem>
              </SelectContent>
            </Select>
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

export default function AutomationFlow({ auto, setAuto, forms, stages, stepStats, whatsappTemplates }: Props) {
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
      <div className="flex flex-row items-start gap-0 min-w-max mx-auto w-fit">
        {/* Trigger */}
        <FlowNode
          icon={Zap}
          color={TRIGGER_COLOR}
          typeLabel="Gatilho"
          nodeName={triggerMeta(auto.trigger_type).label}
          detail={describeTrigger(auto.trigger_type, auto.trigger_config, forms, stages)}
          badge="Início"
          config={<TriggerConfig auto={auto} setAuto={setAuto} forms={forms} stages={stages} />}
        />

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
