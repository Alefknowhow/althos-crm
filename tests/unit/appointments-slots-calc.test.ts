import { describe, it, expect } from 'vitest'
import { computeAvailableSlots } from '@/lib/appointments/slots-calc'

// Fixo no passado (relativo às datas de teste, 2026-06-01), pra "now" nunca interferir nos testes que
// não testam explicitamente o filtro de horário passado.
const PAST_NOW = new Date('2020-01-01T00:00:00-03:00').getTime()

describe('computeAvailableSlots', () => {
  it('generates one slot per duration step within a window', () => {
    const slots = computeAvailableSlots({
      dateStr: '2026-06-01',
      windows: [{ start_time: '09:00', end_time: '10:00' }],
      busy: [],
      durationMinutes: 30,
      now: PAST_NOW,
    })
    expect(slots).toEqual([
      new Date('2026-06-01T09:00:00-03:00').toISOString(),
      new Date('2026-06-01T09:30:00-03:00').toISOString(),
    ])
  })

  it('does not generate a slot that would run past the window end', () => {
    // 09:00-09:45 window, 30min duration: only one slot fits (09:00-09:30);
    // 09:30-10:00 would spill past 09:45.
    const slots = computeAvailableSlots({
      dateStr: '2026-06-01',
      windows: [{ start_time: '09:00', end_time: '09:45' }],
      busy: [],
      durationMinutes: 30,
      now: PAST_NOW,
    })
    expect(slots).toEqual([new Date('2026-06-01T09:00:00-03:00').toISOString()])
  })

  it('accounts for buffer minutes when stepping to the next slot', () => {
    // 30min duration + 15min buffer = 45min step. 09:00-11:00 window fits
    // slots at 09:00, 09:45, 10:30 (10:30+30=11:00, exactly fits).
    const slots = computeAvailableSlots({
      dateStr: '2026-06-01',
      windows: [{ start_time: '09:00', end_time: '11:00' }],
      busy: [],
      durationMinutes: 30,
      bufferMinutes: 15,
      now: PAST_NOW,
    })
    expect(slots).toEqual([
      new Date('2026-06-01T09:00:00-03:00').toISOString(),
      new Date('2026-06-01T09:45:00-03:00').toISOString(),
      new Date('2026-06-01T10:30:00-03:00').toISOString(),
    ])
  })

  it('excludes a slot that overlaps an existing (busy) appointment', () => {
    const busyStart = new Date('2026-06-01T09:30:00-03:00').getTime()
    const busyEnd = new Date('2026-06-01T10:00:00-03:00').getTime()
    const slots = computeAvailableSlots({
      dateStr: '2026-06-01',
      windows: [{ start_time: '09:00', end_time: '10:30' }],
      busy: [{ start: busyStart, end: busyEnd }],
      durationMinutes: 30,
      now: PAST_NOW,
    })
    // 09:00 free, 09:30 overlaps busy, 10:00 free
    expect(slots).toEqual([
      new Date('2026-06-01T09:00:00-03:00').toISOString(),
      new Date('2026-06-01T10:00:00-03:00').toISOString(),
    ])
  })

  it('never offers a slot that starts in the past', () => {
    const now = new Date('2026-06-01T09:20:00-03:00').getTime()
    const slots = computeAvailableSlots({
      dateStr: '2026-06-01',
      windows: [{ start_time: '09:00', end_time: '10:00' }],
      busy: [],
      durationMinutes: 30,
      now,
    })
    // 09:00 is in the past relative to "now" (09:20) — only 09:30 remains
    expect(slots).toEqual([new Date('2026-06-01T09:30:00-03:00').toISOString()])
  })

  it('skips a window with an unparseable time instead of throwing', () => {
    const slots = computeAvailableSlots({
      dateStr: '2026-06-01',
      windows: [{ start_time: 'not-a-time', end_time: '10:00' }],
      busy: [],
      durationMinutes: 30,
      now: PAST_NOW,
    })
    expect(slots).toEqual([])
  })

  it('merges slots from multiple availability windows on the same day', () => {
    const slots = computeAvailableSlots({
      dateStr: '2026-06-01',
      windows: [
        { start_time: '09:00', end_time: '09:30' },
        { start_time: '14:00', end_time: '14:30' },
      ],
      busy: [],
      durationMinutes: 30,
      now: PAST_NOW,
    })
    expect(slots).toEqual([
      new Date('2026-06-01T09:00:00-03:00').toISOString(),
      new Date('2026-06-01T14:00:00-03:00').toISOString(),
    ])
  })
})
