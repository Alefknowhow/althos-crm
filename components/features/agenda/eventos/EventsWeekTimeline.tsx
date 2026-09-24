'use client'

/**
 * Timeline por hora (Semana = 7 dias, Dia = 1 dia) — visual estilo Google
 * Agenda: clicar/arrastar num trecho vazio seleciona o horário (mínimo
 * 30min) e abre o popover de criação rápida; eventos existentes arrastam
 * pra reagendar. Adaptado de TasksBoardWeekView.tsx (que ficou só em Tasks
 * depois da separação Tarefas/Eventos, set/2026) pro shape de Event
 * (start_at/end_at explícitos, sem "sem duração = bloco fixo" — todo evento
 * tem intervalo real).
 */

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { WEEKDAYS_PT, ymd } from '@/components/features/tasks/TasksBoardShared'
import { ROW_H, eventDaySegment, computeOverlapLayout } from './EventsShared'
import EventChip from './EventChip'
import type { EventRow } from '@/actions/events'
import type { EventRangeSelection } from './EventQuickCreatePopover'

type DragState = { day: string; rectTop: number; rectLeft: number; rectRight: number; startMin: number; endMin: number }

export default function EventsWeekTimeline({
  days, hours, todayYmd, eventsByDay,
  dragOverKey, setDragOverKey,
  onDropAllDay, onDropSlot, onChipDragStart, onChipDragEnd,
  onRangeSelected, onOpenEvent,
}: {
  days: Date[]
  hours: number[]
  todayYmd: string
  eventsByDay: Map<string, EventRow[]>
  dragOverKey: string | null
  setDragOverKey: (k: string | null) => void
  onDropAllDay: (e: React.DragEvent, dayYmd: string) => void
  onDropSlot: (e: React.DragEvent, dayYmd: string, hour: number) => void
  onChipDragStart: (e: React.DragEvent, id: string) => void
  onChipDragEnd: () => void
  onRangeSelected: (selection: EventRangeSelection) => void
  onOpenEvent: (event: EventRow) => void
}) {
  const gridCols = days.length === 1 ? '56px_1fr' : `56px_repeat(${days.length},minmax(0,1fr))`

  // Linha vermelha da hora atual — atualiza a cada minuto, não a cada
  // render, pra não custar re-render constante no resto do painel.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])
  const nowInHourRange = now.getHours() >= hours[0] && now.getHours() <= hours[hours.length - 1]
  const nowTop = (now.getHours() - hours[0]) * ROW_H + (now.getMinutes() / 60) * ROW_H

  // Seleção por arraste — clique/arraste numa área vazia da timeline pra
  // selecionar o horário; ao soltar, `onRangeSelected` recebe o intervalo +
  // a posição em tela pro popover de criação abrir ancorado ali do lado.
  const dragRef = useRef<DragState | null>(null)
  const [preview, setPreview] = useState<{ day: string; topMin: number; endMin: number } | null>(null)

  function minutesFromClientY(clientY: number, rectTop: number): number {
    const raw = ((clientY - rectTop) / ROW_H) * 60
    const snapped = Math.round(raw / 15) * 15
    return Math.max(0, Math.min(hours.length * 60, snapped))
  }
  function minutesToTime(minFromStart: number): string {
    const total = hours[0] * 60 + minFromStart
    const h = Math.floor(total / 60)
    const m = total % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  function handleColumnMouseDown(e: React.MouseEvent<HTMLDivElement>, day: string) {
    if (e.button !== 0) return
    // Não inicia seleção ao clicar num evento existente (o chip cuida do
    // próprio clique/drag) — só em área vazia da timeline.
    if ((e.target as HTMLElement).closest('[data-quickadd-ignore]')) return
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const startMin = minutesFromClientY(e.clientY, rect.top)
    const state: DragState = { day, rectTop: rect.top, rectLeft: rect.left, rectRight: rect.right, startMin, endMin: startMin + 30 }
    dragRef.current = state
    setPreview({ day, topMin: startMin, endMin: startMin + 30 })

    function onMove(ev: MouseEvent) {
      if (!dragRef.current) return
      const endMin = minutesFromClientY(ev.clientY, dragRef.current.rectTop)
      dragRef.current.endMin = endMin
      setPreview({
        day: dragRef.current.day,
        topMin: Math.min(dragRef.current.startMin, endMin),
        endMin: Math.max(dragRef.current.startMin, endMin),
      })
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      const d = dragRef.current
      dragRef.current = null
      setPreview(null)
      if (!d) return
      const topMin = Math.min(d.startMin, d.endMin)
      const endMin = Math.max(topMin + 30, Math.max(d.startMin, d.endMin))
      onRangeSelected({
        day: d.day,
        startTime: minutesToTime(topMin),
        endTime: minutesToTime(endMin),
        anchor: {
          top: d.rectTop + (topMin / 60) * ROW_H,
          bottom: d.rectTop + (endMin / 60) * ROW_H,
          left: d.rectLeft,
          right: d.rectRight,
        },
      })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div className="rounded-[8px] border bg-card overflow-hidden">
      {/* Cabeçalho dos dias */}
      <div className="grid border-b" style={{ gridTemplateColumns: gridCols }}>
        <div />
        {days.map(d => {
          const key = ymd(d)
          const isToday = key === todayYmd
          return (
            <div key={key} className="py-2 text-center border-l min-w-0">
              <div className="text-[11px] text-muted-foreground">{WEEKDAYS_PT[d.getDay()]}</div>
              <div className={cn(
                'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs mt-0.5',
                isToday ? 'bg-primary text-primary-foreground font-semibold' : 'text-foreground',
              )}>
                {d.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      {/* Dia inteiro */}
      <div className="grid border-b bg-muted/10" style={{ gridTemplateColumns: gridCols }}>
        <div className="text-[10px] text-muted-foreground px-1.5 py-2 uppercase tracking-wide">Dia inteiro</div>
        {days.map(d => {
          const key = ymd(d)
          const allDay = (eventsByDay.get(key) || []).filter(e => e.all_day)
          const isDragOver = dragOverKey === `allday:${key}`
          return (
            <div
              key={key}
              onDragOver={e => { e.preventDefault(); setDragOverKey(`allday:${key}`) }}
              onDragLeave={() => setDragOverKey(null)}
              onDrop={e => onDropAllDay(e, key)}
              className={cn('border-l px-1 py-1.5 space-y-0.5 min-h-[36px] min-w-0', isDragOver && 'bg-primary/5 ring-2 ring-inset ring-primary/40')}
            >
              {allDay.map(ev => (
                <EventChip key={ev.id} event={ev} onOpen={() => onOpenEvent(ev)} onDragStart={e => onChipDragStart(e, ev.id)} onDragEnd={onChipDragEnd} />
              ))}
            </div>
          )
        })}
      </div>

      {/* Timeline */}
      <div className="grid relative select-none" style={{ gridTemplateColumns: gridCols }}>
        {/* Coluna de horas */}
        <div>
          {hours.map(h => (
            <div key={h} style={{ height: ROW_H }} className="text-[10px] text-muted-foreground text-right pr-1.5 -mt-[6px] tabular-nums">
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>

        {days.map(d => {
          const key = ymd(d)
          const timed = (eventsByDay.get(key) || []).filter(e => !e.all_day)
          const overlapLayout = computeOverlapLayout(timed.map(ev => ({ id: ev.id, ...eventDaySegment(ev, key) })))
          const dayPreview = preview && preview.day === key ? preview : null
          return (
            <div key={key} className="relative border-l min-w-0 cursor-crosshair" onMouseDown={e => handleColumnMouseDown(e, key)}>
              {hours.map(h => {
                const slotKey = `slot:${key}:${h}`
                const isDragOver = dragOverKey === slotKey
                return (
                  <div
                    key={h}
                    style={{ height: ROW_H }}
                    onDragOver={e => { e.preventDefault(); setDragOverKey(slotKey) }}
                    onDragLeave={() => setDragOverKey(null)}
                    onDrop={e => onDropSlot(e, key, h)}
                    className={cn('border-b border-border/60', isDragOver && 'bg-primary/5')}
                  />
                )
              })}

              {/* Preview da seleção sendo arrastada */}
              {dayPreview && (
                <div
                  className="absolute inset-x-0.5 z-30 rounded-md bg-primary/15 border border-primary/40 pointer-events-none"
                  style={{ top: (dayPreview.topMin / 60) * ROW_H, height: ((dayPreview.endMin - dayPreview.topMin) / 60) * ROW_H }}
                />
              )}

              {/* Linha vermelha da hora atual — só na coluna de hoje */}
              {key === todayYmd && nowInHourRange && (
                <div className="absolute left-0 right-0 z-20 pointer-events-none flex items-center" style={{ top: nowTop }}>
                  <span className="w-2 h-2 -ml-1 rounded-full bg-red-500 shrink-0" />
                  <div className="h-px flex-1 bg-red-500" />
                </div>
              )}

              {/* Eventos com horário, recortados ao dia (eventDaySegment) e
                  posicionados proporcionalmente — funciona como agenda. */}
              {timed.map(ev => {
                const { startMin: segStart, endMin: segEnd } = eventDaySegment(ev, key)
                const top = ((segStart - hours[0] * 60) / 60) * ROW_H
                const height = ((segEnd - segStart) / 60) * ROW_H
                const { col, cols } = overlapLayout.get(ev.id) ?? { col: 0, cols: 1 }
                return (
                  <div
                    key={ev.id}
                    data-quickadd-ignore
                    style={{ top, height, left: cols > 1 ? `${(col / cols) * 100}%` : 0, width: cols > 1 ? `${100 / cols}%` : '100%' }}
                    className="absolute px-0.5 z-10"
                  >
                    <div className="h-full">
                      <EventChip expanded event={ev} onOpen={() => onOpenEvent(ev)} onDragStart={e => onChipDragStart(e, ev.id)} onDragEnd={onChipDragEnd} />
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
