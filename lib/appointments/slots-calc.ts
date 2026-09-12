/**
 * Geração de horários disponíveis — extraída de
 * actions/appointments-public.ts::getAvailableSlots pra ser testável sem
 * mockar Supabase (achado "médio" da auditoria de testes: buffer, step,
 * detecção de overlap e timezone fixo -03:00 sem nenhum teste garantindo
 * comportamento correto).
 *
 * Timezone fixo -03:00 (sem DST — o Brasil não usa horário de verão desde
 * 2019): mesma limitação já presente no código original, preservada aqui.
 */

export type AvailabilityWindow = { start_time: string; end_time: string } // 'HH:MM[:SS]'
export type BusyInterval = { start: number; end: number } // epoch ms

export function computeAvailableSlots(params: {
  dateStr: string // 'YYYY-MM-DD'
  windows: AvailabilityWindow[]
  busy: BusyInterval[]
  durationMinutes: number
  bufferMinutes?: number // soma de buffer_before + buffer_after
  now?: number // epoch ms, default Date.now() — injetável pra teste determinístico
}): string[] {
  const { dateStr, windows, busy, durationMinutes, bufferMinutes = 0, now = Date.now() } = params
  const step = durationMinutes + bufferMinutes
  const slots: string[] = []

  for (const w of windows) {
    const wStart = new Date(`${dateStr}T${w.start_time}-03:00`).getTime()
    const wEnd = new Date(`${dateStr}T${w.end_time}-03:00`).getTime()
    if (!Number.isFinite(wStart) || !Number.isFinite(wEnd)) continue

    for (let t = wStart; t + durationMinutes * 60_000 <= wEnd; t += step * 60_000) {
      const slotStart = t
      const slotEnd = t + durationMinutes * 60_000
      if (slotStart <= now) continue // nunca oferece horário no passado
      const overlaps = busy.some(b => !(slotEnd <= b.start || slotStart >= b.end))
      if (overlaps) continue
      slots.push(new Date(slotStart).toISOString())
    }
  }

  return slots
}
