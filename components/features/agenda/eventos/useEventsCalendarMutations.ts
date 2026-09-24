import { useState } from 'react'
import { toast } from 'sonner'
import { updateEvent, type EventRow } from '@/actions/events'
import { ROW_H } from './EventsShared'

/**
 * Drag-and-drop de reagendamento na timeline de Semana/Dia (Agenda →
 * Eventos) — mesmo espírito de useTasksBoardMutations (que ficou só em
 * Tasks depois da separação Tarefas/Eventos, set/2026), adaptado pro
 * intervalo start_at/end_at de Event em vez de due_date+duration_minutes.
 */
export function useEventsCalendarMutations({
  orgSlug, events, setEvents, onChanged,
}: {
  orgSlug: string
  events: EventRow[]
  setEvents: React.Dispatch<React.SetStateAction<EventRow[]>>
  /** Chamado após uma mutation bem-sucedida — deixa o caller refazer o
   *  fetch da janela atual (mesmo motivo do onSaved/onDeleted do EventDialog:
   *  router.refresh() sozinho não repõe estado de client component). */
  onChanged?: () => void
}) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)

  function onChipDragStart(e: React.DragEvent, id: string) {
    e.dataTransfer.setData('text/plain', id)
    e.dataTransfer.effectAllowed = 'move'
    setDragId(id)
  }
  function onChipDragEnd() { setDragId(null); setDragOverKey(null) }
  function dropEventId(e: React.DragEvent): string | null {
    return dragId || e.dataTransfer.getData('text/plain') || null
  }

  async function applyReschedule(eventId: string, patch: { start_date: string; start_time: string; end_date: string; end_time: string; all_day: boolean }) {
    const prev = events.find(ev => ev.id === eventId)
    if (!prev) return
    const optimisticStart = `${patch.start_date}T${patch.start_time}:00.000Z`
    const optimisticEnd = `${patch.end_date}T${patch.end_time}:00.000Z`
    setEvents(list => list.map(ev => (ev.id === eventId ? { ...ev, start_at: optimisticStart, end_at: optimisticEnd, all_day: patch.all_day } : ev)))
    const res = await updateEvent(orgSlug, eventId, patch)
    if (!res.ok) {
      setEvents(list => list.map(ev => (ev.id === eventId ? prev : ev)))
      toast.error('Erro ao mover evento')
      return
    }
    onChanged?.()
  }

  /** Solta num slot de hora → vira/continua evento com horário, na duração
   *  original (30min de padrão se vinha de "dia inteiro"). */
  function handleDropOnSlot(e: React.DragEvent, dayYmd: string, hour: number) {
    e.preventDefault()
    const id = dropEventId(e)
    setDragId(null); setDragOverKey(null)
    const event = events.find(ev => ev.id === id)
    if (!event) return

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const offsetY = e.clientY - rect.top
    const minute = Math.min(30, Math.max(0, Math.round((offsetY / ROW_H) * 60 / 30) * 30))
    const startTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`

    const durationMin = event.all_day ? 30 : Math.max(15, Math.round((new Date(event.end_at).getTime() - new Date(event.start_at).getTime()) / 60000))
    const endTotal = hour * 60 + minute + durationMin
    const endTime = `${String(Math.floor(endTotal / 60) % 24).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}`

    applyReschedule(id!, { start_date: dayYmd, start_time: startTime, end_date: dayYmd, end_time: endTime, all_day: false })
  }

  /** Solta em "Dia inteiro" → vira evento de dia inteiro nesse dia. */
  function handleDropOnAllDay(e: React.DragEvent, dayYmd: string) {
    e.preventDefault()
    const id = dropEventId(e)
    setDragId(null); setDragOverKey(null)
    if (!id) return
    applyReschedule(id, { start_date: dayYmd, start_time: '00:00', end_date: dayYmd, end_time: '23:59', all_day: true })
  }

  return { dragOverKey, setDragOverKey, onChipDragStart, onChipDragEnd, handleDropOnSlot, handleDropOnAllDay }
}
