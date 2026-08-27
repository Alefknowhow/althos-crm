import {
  FileText, ArrowRightLeft, Tag, AlarmClock, Clock, Calendar, Gift,
  Stethoscope, Building2, Shield, type LucideIcon,
} from 'lucide-react'
import type { NicheKey } from '@/lib/niche'

export type TriggerTypeMeta = {
  id: string
  label: string
  desc: string
  icon: LucideIcon
  color: string
  /** Só aparece pra seleção em orgs desse nicho — undefined = todos os nichos (CRM genérico). */
  niche?: NicheKey
}

/** Fonte única dos gatilhos de automação — usada tanto no seletor do editor
 *  (`AutomationFlow`) quanto na listagem (`AutomationsShell`), pra ícone e
 *  filtro por nicho nunca divergirem entre as duas telas. */
export const TRIGGER_TYPES: TriggerTypeMeta[] = [
  { id: 'form.submitted',      label: 'Formulário Submetido',     desc: 'Dispara quando um formulário é preenchido',           icon: FileText,      color: '#0ea5e9' },
  { id: 'lead.stage_changed',  label: 'Estágio Alterado',         desc: 'Dispara quando um lead muda de estágio',              icon: ArrowRightLeft, color: '#3b82f6' },
  { id: 'lead.tag_added',      label: 'Tag Adicionada',           desc: 'Dispara quando uma tag é adicionada ao lead',         icon: Tag,           color: '#a855f7' },
  { id: 'task.overdue',        label: 'Tarefa Vencida',           desc: 'Dispara diariamente para tarefas em atraso',          icon: AlarmClock,    color: '#f59e0b' },
  { id: 'lead.stale',          label: 'Lead sem Contato',         desc: 'Dispara após N dias sem atividade',                   icon: Clock,         color: '#94a3b8' },
  { id: 'appointment.booked',  label: 'Agendamento Realizado',    desc: 'Dispara quando um agendamento é criado',              icon: Calendar,      color: '#10b981' },
  { id: 'customer.birthday',   label: 'Aniversário do Cliente',   desc: 'Dispara no aniversário do cliente (verificação diária às 7h)', icon: Gift,   color: '#ec4899' },

  // Vertical Clínicas — sem configuração extra (igual appointment.booked).
  { id: 'clinic.appointment.confirmed', label: 'Agendamento Confirmado (Clínica)', desc: 'Dispara quando o paciente confirma o agendamento', icon: Stethoscope, color: '#14b8a6', niche: 'clinicas' },
  { id: 'clinic.quote.approved',        label: 'Orçamento Aprovado (Clínica)',     desc: 'Dispara quando um orçamento é marcado como aprovado', icon: Stethoscope, color: '#14b8a6', niche: 'clinicas' },
  { id: 'clinic.attendance.completed',  label: 'Atendimento Realizado (Clínica)',  desc: 'Dispara quando um atendimento é registrado como realizado', icon: Stethoscope, color: '#14b8a6', niche: 'clinicas' },

  // Vertical Imobiliárias — sem configuração extra (igual appointment.booked).
  { id: 'imoveis.visit.scheduled', label: 'Visita Agendada (Imóveis)',   desc: 'Dispara quando uma visita a um imóvel é agendada',   icon: Building2, color: '#f97316', niche: 'imoveis' },
  { id: 'imoveis.visit.confirmed', label: 'Visita Confirmada (Imóveis)', desc: 'Dispara quando o lead confirma a visita',            icon: Building2, color: '#f97316', niche: 'imoveis' },
  { id: 'imoveis.visit.canceled',  label: 'Visita Cancelada (Imóveis)',  desc: 'Dispara quando a visita é cancelada',                icon: Building2, color: '#f97316', niche: 'imoveis' },
  { id: 'imoveis.visit.completed', label: 'Visita Realizada (Imóveis)',  desc: 'Dispara quando a visita é marcada como realizada',   icon: Building2, color: '#f97316', niche: 'imoveis' },
  { id: 'imoveis.proposal.sent',   label: 'Proposta Enviada (Imóveis)',  desc: 'Dispara quando uma proposta de imóvel é marcada como enviada', icon: Building2, color: '#f97316', niche: 'imoveis' },
  { id: 'imoveis.deal.closed',     label: 'Negócio Fechado (Imóveis)',   desc: 'Dispara quando uma venda ou locação é registrada',   icon: Building2, color: '#f97316', niche: 'imoveis' },

  // Vertical Seguros.
  { id: 'seguros.policy.issued',      label: 'Apólice Emitida (Seguros)',    desc: 'Dispara quando uma apólice é emitida',                icon: Shield, color: '#6366f1', niche: 'seguros' },
  { id: 'seguros.policy.renewal_due', label: 'Renovação Próxima (Seguros)',  desc: 'Dispara quando uma apólice se aproxima do vencimento', icon: Shield, color: '#6366f1', niche: 'seguros' },
  { id: 'seguros.claim.opened',       label: 'Sinistro Aberto (Seguros)',    desc: 'Dispara quando um sinistro é registrado',              icon: Shield, color: '#6366f1', niche: 'seguros' },
]

export function triggerMeta(type: string): TriggerTypeMeta {
  return TRIGGER_TYPES.find(t => t.id === type) ?? TRIGGER_TYPES[0]
}

/** Gatilhos visíveis pra seleção numa org com este nicho — genéricos (sem
 *  `niche`) sempre aparecem; os de vertical só aparecem no nicho correspondente. */
export function visibleTriggerTypes(nicheKey: NicheKey | null): TriggerTypeMeta[] {
  return TRIGGER_TYPES.filter(t => !t.niche || t.niche === nicheKey)
}
