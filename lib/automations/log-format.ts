/** Shared, JSX-free formatting helpers for the automation logs UI. */

export const STEP_LABEL: Record<string, string> = {
  wait: 'Esperar',
  send_email: 'Enviar E-mail',
  send_whatsapp: 'Enviar WhatsApp',
  create_task: 'Criar Tarefa',
  move_stage: 'Mover Estágio',
  add_tag: 'Adicionar Tag',
  send_push: 'Enviar Push',
  webhook: 'Webhook',
}

export const TRIGGER_LABEL: Record<string, string> = {
  'form.submitted': 'Formulário enviado',
  'lead.stage_changed': 'Mudança de estágio',
  'lead.tag_added': 'Tag adicionada',
  'task.overdue': 'Tarefa vencida',
  'lead.stale': 'Lead parado',
  'appointment.booked': 'Agendamento criado',
  'customer.birthday': 'Aniversário do cliente',
}

export const RUN_STATUS_LABEL: Record<string, string> = {
  running: 'Em andamento',
  completed: 'Concluída',
  failed: 'Falhou',
  cancelled: 'Cancelada',
}

export function stepLabel(type: string): string {
  return STEP_LABEL[type] || type
}

export function triggerLabel(type: string | null | undefined): string {
  if (!type) return '—'
  return TRIGGER_LABEL[type] || type
}

/** Human duration from ms (e.g. 1200 → "1.2s", 65000 → "1min 5s"). */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const min = Math.floor(ms / 60_000)
  const sec = Math.round((ms % 60_000) / 1000)
  return sec ? `${min}min ${sec}s` : `${min}min`
}

/** Total run duration from two ISO timestamps (end defaults to now). */
export function runDuration(startIso: string, endIso: string | null): string {
  const start = new Date(startIso).getTime()
  const end = endIso ? new Date(endIso).getTime() : Date.now()
  return formatDuration(end - start)
}
