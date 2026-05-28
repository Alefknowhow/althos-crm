import { z } from 'zod'

export const taskSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  description: z.string().optional(),
  due_date: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  lead_id: z.string().uuid().optional().or(z.literal('')),
})
