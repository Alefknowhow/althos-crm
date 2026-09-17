import { z } from 'zod'

export const PROJECT_STATUSES = ['a_fazer', 'em_andamento', 'concluido'] as const
export const PROJECT_HEALTHS = ['normal', 'atencao', 'bloqueado', 'aguardando_cliente', 'em_risco'] as const

export type ProjectStatus = (typeof PROJECT_STATUSES)[number]
export type ProjectHealth = (typeof PROJECT_HEALTHS)[number]

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
  client_id: z.string().uuid('Selecione um cliente'),
  description: z.string().optional(),
  objective: z.string().optional(),
  owner_id: z.string().uuid().optional().or(z.literal('')),
  status: z.enum(PROJECT_STATUSES).optional(),
  health: z.enum(PROJECT_HEALTHS).optional(),
  start_date: z.string().optional().or(z.literal('')),
  due_date: z.string().optional().or(z.literal('')),
})

export type ProjectInput = z.infer<typeof projectSchema>

export const projectGroupSchema = z.object({
  project_id: z.string().uuid(),
  name: z.string().min(1, 'Nome é obrigatório'),
})
