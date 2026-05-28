/**
 * Tools the AI attendant can call during a conversation. Each tool has:
 *   - definition (JSON schema sent to Claude so it knows when/how to call)
 *   - executor (server-side function that performs the work, scoped to org)
 *
 * Executors take a `ctx` argument carrying orgSlug + Supabase client so the
 * engine itself stays pure (no DB knowledge).
 *
 * Add new tools by:
 *   1) Pushing a definition to ATTENDANT_TOOLS
 *   2) Adding a case in executeAttendantTool
 *   3) Updating the persona prompt (or knowledge base) so AI knows it exists
 */

import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'

export type ToolContext = {
  orgId: string
  supabase: SupabaseClient
}

export const ATTENDANT_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: 'listar_tipos_evento',
    description:
      'Lista os tipos de atendimento, consulta ou serviço que a empresa oferece (nome, duração em minutos, descrição quando houver). Use quando o cliente perguntar quais serviços você atende, qual o tempo médio, ou quando precisar saber qual evento agendar.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'consultar_disponibilidade',
    description:
      'Consulta horários LIVRES em uma data específica, no fuso de São Paulo. Use quando o cliente perguntar disponibilidade ("tem horário amanhã?", "que horas vocês atendem terça?", "vocês têm vaga essa semana?"). NUNCA invente horários — sempre consulte esta tool antes de oferecer um horário.',
    input_schema: {
      type: 'object',
      properties: {
        data: {
          type: 'string',
          description: 'Data no formato YYYY-MM-DD. Exemplo: 2026-05-25.',
        },
        nome_tipo_evento: {
          type: 'string',
          description:
            'Opcional. Nome do tipo de evento para filtrar (ex: "Consulta 30min"). Se omitido, usa o primeiro tipo ativo da empresa.',
        },
      },
      required: ['data'],
    },
  },
]

/**
 * Resolves a tool call by name → server execution. Returns a plain string
 * that Claude reads as the tool_result content. Errors are returned as
 * `[ERRO: ...]` so the model can react gracefully instead of dying.
 */
export async function executeAttendantTool(
  name: string,
  input: Record<string, any>,
  ctx: ToolContext,
): Promise<string> {
  try {
    switch (name) {
      case 'listar_tipos_evento':
        return await listEventTypes(ctx)
      case 'consultar_disponibilidade':
        return await checkAvailability(input, ctx)
      default:
        return `[ERRO: tool desconhecida "${name}"]`
    }
  } catch (e: any) {
    return `[ERRO ao executar ${name}: ${e?.message || 'falha inesperada'}]`
  }
}

/* -------- Implementations -------- */

async function listEventTypes(ctx: ToolContext): Promise<string> {
  const { data, error } = await ctx.supabase
    .from('event_types')
    .select('name, slug, description, duration_minutes, location')
    .eq('organization_id', ctx.orgId)
    .eq('is_active', true)
    .order('duration_minutes', { ascending: true })

  if (error) return `[ERRO: ${error.message}]`
  if (!data || data.length === 0) {
    return 'Nenhum tipo de evento ativo cadastrado nesta empresa.'
  }

  const lines = data.map(et => {
    const parts = [`- ${et.name} (${et.duration_minutes} min)`]
    if (et.description) parts.push(`  Descrição: ${et.description}`)
    if (et.location) parts.push(`  Local: ${et.location}`)
    return parts.join('\n')
  })
  return `Tipos de evento disponíveis:\n${lines.join('\n')}`
}

async function checkAvailability(
  input: Record<string, any>,
  ctx: ToolContext,
): Promise<string> {
  const dateStr = String(input.data || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return `[ERRO: data inválida "${dateStr}". Use YYYY-MM-DD]`
  }

  // Pick event type: by name if provided, otherwise the first active type.
  const requestedName = (input.nome_tipo_evento || '').toString().trim().toLowerCase()
  const { data: types } = await ctx.supabase
    .from('event_types')
    .select(
      'id, name, slug, duration_minutes, buffer_before_minutes, buffer_after_minutes, is_active',
    )
    .eq('organization_id', ctx.orgId)
    .eq('is_active', true)

  if (!types || types.length === 0) {
    return 'Nenhum tipo de evento ativo cadastrado — não posso consultar disponibilidade ainda.'
  }

  const eventType = requestedName
    ? types.find(t => t.name.toLowerCase().includes(requestedName)) || types[0]
    : types[0]

  // Reuse the slot-computation logic by inlining the core math here (the
  // existing getAvailableSlots takes orgSlug+eventSlug from anonymous-user
  // context; here we already have org_id and don't want a second org lookup).
  const dayStart = new Date(`${dateStr}T00:00:00-03:00`)
  const dayEnd = new Date(`${dateStr}T23:59:59-03:00`)
  if (isNaN(dayStart.getTime())) {
    return `[ERRO: não consegui parsear a data ${dateStr}]`
  }
  const dow = dayStart.getDay()

  // Availability windows: prefer event-specific, fall back to org-wide.
  let { data: windows } = await ctx.supabase
    .from('availabilities')
    .select('start_time, end_time')
    .eq('organization_id', ctx.orgId)
    .eq('event_type_id', eventType.id)
    .eq('day_of_week', dow)

  if (!windows || windows.length === 0) {
    const { data: orgWide } = await ctx.supabase
      .from('availabilities')
      .select('start_time, end_time')
      .eq('organization_id', ctx.orgId)
      .is('event_type_id', null)
      .eq('day_of_week', dow)
    windows = orgWide || []
  }

  if (!windows || windows.length === 0) {
    return `${formatDateBR(dayStart)}: sem horário de atendimento configurado (${dayOfWeekName(dow)}).`
  }

  // Existing appointments on this day (excluding canceled).
  const { data: existing } = await ctx.supabase
    .from('appointments')
    .select('start_time, end_time, status')
    .eq('organization_id', ctx.orgId)
    .neq('status', 'canceled')
    .gte('start_time', dayStart.toISOString())
    .lte('start_time', dayEnd.toISOString())

  const busy = (existing || []).map(a => ({
    start: new Date(a.start_time).getTime(),
    end: new Date(a.end_time).getTime(),
  }))

  const duration = eventType.duration_minutes
  const buffer =
    (eventType.buffer_before_minutes || 0) + (eventType.buffer_after_minutes || 0)
  const step = duration + buffer
  const now = Date.now()
  const slots: string[] = []

  for (const w of windows) {
    const wStart = new Date(`${dateStr}T${w.start_time}-03:00`).getTime()
    const wEnd = new Date(`${dateStr}T${w.end_time}-03:00`).getTime()
    if (!Number.isFinite(wStart) || !Number.isFinite(wEnd)) continue

    for (let t = wStart; t + duration * 60_000 <= wEnd; t += step * 60_000) {
      const slotEnd = t + duration * 60_000
      if (t <= now) continue
      const overlaps = busy.some(b => !(slotEnd <= b.start || t >= b.end))
      if (overlaps) continue
      slots.push(
        new Date(t).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'America/Sao_Paulo',
        }),
      )
    }
  }

  if (slots.length === 0) {
    return `${formatDateBR(dayStart)} (${dayOfWeekName(dow)}): nenhum horário livre. Já preenchido ou fora do expediente.`
  }

  // Group adjacent slots in lists of up to 12 to keep response compact.
  const visible = slots.slice(0, 12)
  const extra = slots.length - visible.length
  return [
    `Tipo de evento: ${eventType.name} (${duration} min)`,
    `Data: ${formatDateBR(dayStart)} (${dayOfWeekName(dow)})`,
    `Horários livres: ${visible.join(', ')}${extra > 0 ? ` (+${extra} outros)` : ''}`,
  ].join('\n')
}

/* -------- Helpers -------- */

function formatDateBR(d: Date): string {
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  })
}

const DAY_NAMES_PT = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
]
function dayOfWeekName(dow: number): string {
  return DAY_NAMES_PT[dow] || ''
}
