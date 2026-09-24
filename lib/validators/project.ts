import { z } from 'zod'

export const PROJECT_STATUSES = ['a_fazer', 'em_andamento', 'concluido'] as const
export const PROJECT_HEALTHS = ['normal', 'atencao', 'bloqueado', 'aguardando_cliente', 'em_risco'] as const

export type ProjectStatus = (typeof PROJECT_STATUSES)[number]
export type ProjectHealth = (typeof PROJECT_HEALTHS)[number]

// Legado (pré-#17) — status virou etapa configurável (project_columns via
// column_id). Mantidos só pra ler/exibir dado histórico se necessário; não
// são mais escritos por nenhum fluxo novo.
export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  a_fazer: 'A fazer',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
}

export const PROJECT_HEALTH_LABEL: Record<ProjectHealth, string> = {
  normal: 'Normal',
  atencao: 'Atenção',
  bloqueado: 'Bloqueado',
  aguardando_cliente: 'Aguardando cliente',
  em_risco: 'Em risco',
}

export const projectSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  // Opcional desde a issue #14 (Agenda → Projetos): um projeto pode existir
  // sem cliente vinculado, para uso interno.
  client_id: z.string().uuid().optional().or(z.literal('')),
  description: z.string().optional(),
  objective: z.string().optional(),
  owner_id: z.string().uuid().optional().or(z.literal('')),
  // Etapa do Kanban configurável (issue #17) — substitui `status`.
  column_id: z.string().uuid().optional().or(z.literal('')),
  health: z.enum(PROJECT_HEALTHS).optional(),
  start_date: z.string().optional().or(z.literal('')),
  due_date: z.string().optional().or(z.literal('')),
  tags: z.array(z.string().min(1)).optional(),
})

export type ProjectInput = z.infer<typeof projectSchema>

export const projectGroupSchema = z.object({
  project_id: z.string().uuid(),
  name: z.string().min(1, 'Nome é obrigatório'),
})
