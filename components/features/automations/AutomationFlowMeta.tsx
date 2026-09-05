import {
  Clock,
  Mail,
  MessageSquare,
  CheckSquare,
  ArrowRightLeft,
  Tag,
  Bell,
  Webhook,
  XCircle,
  Smile,
} from 'lucide-react'
import { triggerMeta as sharedTriggerMeta } from '@/lib/automations/trigger-meta'

// ── Metadata ────────────────────────────────────────────────────────────────

export const STEP_TYPES = [
  { id: 'send_email',    label: 'Enviar E-mail',    icon: Mail,           color: '#ef4444', desc: 'Envia um template de e-mail para o lead' },
  { id: 'send_whatsapp', label: 'WhatsApp',         icon: MessageSquare,  color: '#10b981', desc: 'Envia uma mensagem via WhatsApp Business' },
  { id: 'create_task',   label: 'Criar Tarefa',     icon: CheckSquare,    color: '#f59e0b', desc: 'Cria uma tarefa vinculada ao lead' },
  { id: 'move_stage',    label: 'Mover Estágio',    icon: ArrowRightLeft, color: '#3b82f6', desc: 'Move o lead para outro estágio do pipeline' },
  { id: 'close_deal',    label: 'Fechar Negociação', icon: XCircle,       color: '#dc2626', desc: 'Marca o lead como perdido ou desqualificado, tirando-o do board' },
  { id: 'add_tag',       label: 'Adicionar Tag',    icon: Tag,            color: '#a855f7', desc: 'Adiciona uma tag ao perfil do lead' },
  { id: 'send_push',     label: 'Notificação Push', icon: Bell,           color: '#0ea5e9', desc: 'Envia push notification para a equipe' },
  { id: 'send_nps_survey', label: 'Pesquisa NPS',   icon: Smile,          color: '#22c55e', desc: 'Envia a pergunta "de 0 a 10..." por WhatsApp e aguarda a nota' },
  { id: 'webhook',       label: 'Webhook Externo',  icon: Webhook,        color: '#d946ef', desc: 'Chama uma URL externa com dados do lead' },
  { id: 'wait',          label: 'Aguardar',         icon: Clock,          color: '#94a3b8', desc: 'Pausa a execução por um período definido' },
] as const

export const TRIGGER_COLOR = '#7c3aed'

export type Step = { id: string; type: string; config: Record<string, any> }

export type StepStat = { success: number; errors: number }

export type WaTemplate = {
  id: string
  name: string
  display_name: string
  body_text: string
  variable_names: string[] | null
  header_type: string
  header_media_url: string | null
  language: string
}

export type FormOpt = { id: string; name: string }
export type StageOpt = { id: string; name: string }

// ── Helpers ──────────────────────────────────────────────────────────────────

export function stepMeta(type: string) {
  return STEP_TYPES.find(s => s.id === type) ?? STEP_TYPES[STEP_TYPES.length - 1]
}

export const triggerMeta = sharedTriggerMeta

export function describeTrigger(type: string, config: any, forms: FormOpt[], stages: StageOpt[]): string {
  if (type === 'form.submitted')     return forms.find(f => f.id === config?.formId)?.name ?? 'Qualquer formulário'
  if (type === 'lead.stage_changed') return stages.find(s => s.id === config?.stageId)?.name ?? 'Qualquer estágio'
  if (type === 'lead.tag_added')     return config?.tag ? `Tag: ${config.tag}` : 'Qualquer tag'
  if (type === 'task.overdue')       return 'Verificação diária às 8h'
  if (type === 'lead.stale')         return `Sem contato há ${config?.staleDays ?? 7} dias`
  if (type === 'appointment.booked') return 'Novo agendamento recebido'
  if (type === 'customer.birthday')  return 'No aniversário do cliente'
  if (type === 'customer.converted') return 'Quando o lead vira cliente (negócio ganho)'
  if (type === 'clinic.appointment.confirmed') return 'Paciente confirmou o agendamento'
  if (type === 'clinic.quote.approved')        return 'Orçamento aprovado'
  if (type === 'clinic.attendance.completed')  return 'Atendimento registrado como realizado'
  if (type === 'imoveis.visit.scheduled') return 'Nova visita agendada'
  if (type === 'imoveis.visit.confirmed') return 'Lead confirmou a visita'
  if (type === 'imoveis.visit.canceled')  return 'Visita cancelada'
  if (type === 'imoveis.visit.completed') return 'Visita registrada como realizada'
  if (type === 'imoveis.proposal.sent')   return 'Proposta enviada'
  if (type === 'imoveis.deal.closed')     return 'Negócio fechado'
  if (type === 'seguros.policy.issued')   return 'Apólice emitida'
  if (type === 'seguros.policy.renewal_due') return 'Renovação próxima'
  if (type === 'seguros.claim.opened')    return 'Sinistro aberto'
  return ''
}

export function describeStep(step: Step, stages: StageOpt[]): string {
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
    case 'send_nps_survey': return 'Pergunta fixa "de 0 a 10..."'
    default:              return ''
  }
}
