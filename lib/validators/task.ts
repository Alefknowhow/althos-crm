import { z } from 'zod'

export const RELATED_ENTITY_TYPES = [
  'travel_proposal',
  'appointment',
  'sale',
  'property_deal',
  'property_proposal',
] as const

export const taskSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  description: z.string().optional(),
  due_date: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high']).optional(),
  contato_id: z.string().uuid().optional().or(z.literal('')),
  assigned_to: z.string().uuid().optional().or(z.literal('')),
  sale_id: z.string().uuid().optional().or(z.literal('')),
  related_entity_type: z.enum(RELATED_ENTITY_TYPES).optional().or(z.literal('')),
  related_entity_id: z.string().uuid().optional().or(z.literal('')),
})
