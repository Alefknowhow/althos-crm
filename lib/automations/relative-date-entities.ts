import type { NicheKey } from '@/lib/niche'

/**
 * Registry de entidades/campos suportados pelo trigger genérico de "data
 * relativa" (issue #18, seção 4) — uma allowlist explícita, não uma coluna
 * arbitrária escolhida pelo usuário, pra nunca virar SQL livre.
 *
 * Cada entrada sabe resolver o registro pra um `contato_id` (a maioria das
 * actions do motor de automação — enviar WhatsApp, criar Task, etc. — espera
 * um lead como sujeito da execução).
 */
export type RelativeDateEntityKey =
  | 'travel_sales.departure_date'
  | 'travel_sales.return_date'
  | 'tasks.due_date'
  | 'contatos.date_of_birth'

export type RelativeDateEntityMeta = {
  key: RelativeDateEntityKey
  label: string
  table: string
  dateColumn: string
  /** `date` compara com igualdade de string 'YYYY-MM-DD'; `timestamptz`
   *  precisa de um range (00:00–24:00 do dia, em horário de São Paulo). */
  columnType: 'date' | 'timestamptz'
  /** Coluna que aponta pro lead dono do registro (null quando a própria
   *  entidade É o contato, como `contatos.date_of_birth`). */
  contatoColumn: string | null
  /** Repete todo ano ignorando o ano da data-base (só aniversário, hoje). */
  recurringYearly: boolean
  /** Só aparece pra seleção em orgs desse nicho — undefined = qualquer nicho. */
  niche?: NicheKey
}

export const RELATIVE_DATE_ENTITIES: RelativeDateEntityMeta[] = [
  {
    key: 'travel_sales.departure_date',
    label: 'Data de embarque (Reserva)',
    table: 'travel_sales',
    dateColumn: 'departure_date',
    columnType: 'date',
    contatoColumn: 'contato_id',
    recurringYearly: false,
    niche: 'viagens',
  },
  {
    key: 'travel_sales.return_date',
    label: 'Data de retorno (Reserva)',
    table: 'travel_sales',
    dateColumn: 'return_date',
    columnType: 'date',
    contatoColumn: 'contato_id',
    recurringYearly: false,
    niche: 'viagens',
  },
  {
    key: 'tasks.due_date',
    label: 'Vencimento de Tarefa',
    table: 'tasks',
    dateColumn: 'due_date',
    columnType: 'timestamptz',
    contatoColumn: 'contato_id',
    recurringYearly: false,
  },
  {
    key: 'contatos.date_of_birth',
    label: 'Aniversário do Cliente',
    table: 'contatos',
    dateColumn: 'date_of_birth',
    columnType: 'date',
    contatoColumn: null,
    recurringYearly: true,
  },
]

export function relativeDateEntityMeta(key: string): RelativeDateEntityMeta | undefined {
  return RELATIVE_DATE_ENTITIES.find(e => e.key === key)
}

export function visibleRelativeDateEntities(nicheKey: NicheKey | null): RelativeDateEntityMeta[] {
  return RELATIVE_DATE_ENTITIES.filter(e => !e.niche || e.niche === nicheKey)
}

export type RelativeDateDirection = 'before' | 'after' | 'on'
export type RelativeDateUnit = 'days' | 'weeks' | 'months'

export type RelativeDateTriggerConfig = {
  entity: RelativeDateEntityKey
  direction: RelativeDateDirection
  /** Ignorado quando direction = 'on'. */
  amount: number
  unit: RelativeDateUnit
  /** 'HH:MM' em horário de São Paulo (mesmo padrão já usado pelos crons fixos
   *  do módulo — sem timezone configurável por org ainda). */
  timeOfDay: string
}

export const DEFAULT_RELATIVE_DATE_CONFIG: RelativeDateTriggerConfig = {
  entity: 'travel_sales.departure_date',
  direction: 'before',
  amount: 7,
  unit: 'days',
  timeOfDay: '09:00',
}
