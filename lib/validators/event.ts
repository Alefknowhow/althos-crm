import { z } from 'zod'

export const EVENT_TYPES = ['presencial', 'google_meet', 'zoom', 'teams', 'ligacao', 'outro'] as const
export type EventType = (typeof EVENT_TYPES)[number]

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  presencial: 'Presencial',
  google_meet: 'Google Meet',
  zoom: 'Zoom',
  teams: 'Microsoft Teams',
  ligacao: 'Chamada telefônica',
  outro: 'Outro',
}

// Mesmo par genérico "Relacionado a" de tasks.related_entity_* (ver
// lib/validators/task.ts) — sem 'reserva' dedicada: events não tem uma
// coluna sale_id própria, só o slot genérico.
export const EVENT_RELATED_ENTITY_TYPES = [
  'travel_proposal',
  'appointment',
  'sale',
  'property_deal',
  'property_proposal',
] as const

export const eventSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório'),
  description: z.string().optional(),
  notes: z.string().optional(),
  start_date: z.string().min(1, 'Data é obrigatória'),
  start_time: z.string().optional(),
  end_date: z.string().optional(),
  end_time: z.string().optional(),
  all_day: z.boolean().optional(),
  event_type: z.enum(EVENT_TYPES).optional(),
  location: z.string().optional(),
  organizer_id: z.string().uuid().optional().or(z.literal('')),
  participant_ids: z.array(z.string().uuid()).optional(),
  color: z.string().nullable().optional(),
  contato_id: z.string().uuid().optional().or(z.literal('')),
  related_entity_type: z.enum(EVENT_RELATED_ENTITY_TYPES).optional().or(z.literal('')),
  related_entity_id: z.string().uuid().optional().or(z.literal('')),
})

export type EventInput = z.infer<typeof eventSchema>
