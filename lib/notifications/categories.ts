/**
 * Canonical catalogue of notification categories.
 *
 * Client-safe: this file has NO server imports so it can be shared by the
 * settings UI (toggles) and by server-side push gating.
 *
 * Each notification we send is tagged with a `NotificationCategory`. A user's
 * preferences are stored as `Record<NotificationCategory, boolean>` (opt-out
 * model — anything missing or unset defaults to ON). When a push is about to be
 * sent, the dispatcher checks the recipient's preference for that category and
 * skips the send if it's disabled.
 */

export type NotificationCategory =
  // Automações
  | 'automation_executed'
  | 'automation_failed'
  | 'automation_scheduled'
  | 'instagram_reply'
  // CRM
  | 'new_lead'
  | 'new_sale'
  | 'proposal_approved'
  // Mensagens
  | 'whatsapp_message'
  // Tarefas
  | 'task_created'
  | 'task_due'
  | 'task_completed'

export interface NotificationCategoryDef {
  key: NotificationCategory
  label: string
  description: string
}

export interface NotificationGroupDef {
  key: string
  label: string
  /** Niche gate — group only shown when the predicate passes (default: always). */
  travelOnly?: boolean
  items: NotificationCategoryDef[]
}

export const NOTIFICATION_GROUPS: NotificationGroupDef[] = [
  {
    key: 'automacoes',
    label: 'Automações',
    items: [
      { key: 'automation_executed', label: 'Automação executada', description: 'Quando uma automação roda com sucesso.' },
      { key: 'automation_failed',   label: 'Automação falhou',     description: 'Quando uma automação falha ao executar.' },
      { key: 'automation_scheduled',label: 'Automação programada',  description: 'Quando uma automação é agendada para rodar.' },
      { key: 'instagram_reply',     label: 'Resposta no Instagram', description: 'Quando a IA responde alguém em DMs ou comentários.' },
    ],
  },
  {
    key: 'crm',
    label: 'CRM',
    items: [
      { key: 'new_lead',          label: 'Novo lead',           description: 'Quando um novo lead entra no funil.' },
      { key: 'new_sale',          label: 'Nova venda',          description: 'Quando uma venda é registrada.' },
      { key: 'proposal_approved', label: 'Proposta aprovada',   description: 'Quando uma proposta é aprovada pelo cliente.' },
    ],
  },
  {
    key: 'mensagens',
    label: 'Mensagens',
    items: [
      { key: 'whatsapp_message', label: 'Nova mensagem WhatsApp', description: 'Quando chega uma mensagem no WhatsApp.' },
    ],
  },
  {
    key: 'tarefas',
    label: 'Tarefas',
    items: [
      { key: 'task_created',   label: 'Tarefa criada',     description: 'Quando uma tarefa é atribuída a você.' },
      { key: 'task_due',       label: 'Tarefa vencida',    description: 'Quando uma tarefa atinge o prazo.' },
      { key: 'task_completed', label: 'Tarefa concluída',  description: 'Quando uma tarefa é marcada como concluída.' },
    ],
  },
]

/** Flat list of every category key. */
export const ALL_NOTIFICATION_CATEGORIES: NotificationCategory[] =
  NOTIFICATION_GROUPS.flatMap(g => g.items.map(i => i.key))

export type NotificationPrefs = Record<string, boolean>

/** A user's effective preference for a category (defaults to ON when unset). */
export function isCategoryEnabled(prefs: NotificationPrefs | null | undefined, category: NotificationCategory): boolean {
  if (!prefs) return true
  return prefs[category] !== false
}

/** Build a fully-populated prefs object (all ON) merged with stored overrides. */
export function withDefaults(prefs: NotificationPrefs | null | undefined): NotificationPrefs {
  const out: NotificationPrefs = {}
  for (const cat of ALL_NOTIFICATION_CATEGORIES) {
    out[cat] = prefs ? prefs[cat] !== false : true
  }
  return out
}
