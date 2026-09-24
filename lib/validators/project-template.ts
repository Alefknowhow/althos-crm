import { z } from 'zod'

/** Um step vira uma Task ao aplicar o template — offset_days é relativo à
 *  data de referência escolhida na hora de aplicar (normalmente o início do
 *  projeto), mesmo cálculo de lib/inngest/automation-step-executor.ts
 *  (case 'create_task'). `group` é opcional — quando presente, agrupa a
 *  task criada num projeto_grupo com esse nome (criado se não existir). */
export const projectTemplateStepSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório'),
  description: z.string().optional(),
  offset_days: z.number().int().min(0).default(0),
  priority: z.enum(['low', 'normal', 'high']).optional(),
  group: z.string().optional(),
})

export type ProjectTemplateStep = z.infer<typeof projectTemplateStepSchema>

export const projectTemplateSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  description: z.string().optional(),
  steps: z.array(projectTemplateStepSchema).min(1, 'Adicione ao menos um passo'),
})

export type ProjectTemplateInput = z.infer<typeof projectTemplateSchema>

export const applyProjectTemplateSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  client_id: z.string().uuid().optional().or(z.literal('')),
  owner_id: z.string().uuid().optional().or(z.literal('')),
  start_date: z.string().min(1, 'Data de referência é obrigatória'),
})

export type ApplyProjectTemplateInput = z.infer<typeof applyProjectTemplateSchema>
