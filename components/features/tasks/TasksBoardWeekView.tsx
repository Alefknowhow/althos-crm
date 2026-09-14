'use client'

/**
 * Week-timeline calendar view for TasksBoard. Split out of
 * TasksBoardCalendarViews.tsx — prop-driven, none of this reads
 * TasksBoard's local state directly.
 *
 * Criação rápida por arraste: clique e arraste num trecho vazio da
 * timeline pra selecionar o horário (mínimo 30min — um clique simples,
 * sem arrastar, já cria um bloco padrão de 30min a partir do ponto
 * clicado). Ao soltar o mouse, `onRangeSelected` recebe o intervalo +
 * a posição em tela do trecho, pra o popover de criação (renderizado
 * pelo componente pai) abrir ancorado ali do lado — ver
 * TasksBoardQuickCreatePopover.tsx.
 */

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { WEEKDAYS_PT, ROW_H, ymd, dueTimeOnly, type Task, type Member } from './TasksBoardShared'
import { CalendarTaskChip } from './TasksBoardCalendarViews'
import { type QuickAddSelection } from './TasksBoardQuickCreatePopover'

type DragState = { day: string; rectTop: number; rectLeft: number; rectRight: number; startMin: number; endMin: number }

export function WeekTimeline({
  days, hours, todayYmd, tasksByDate, members, highlightId,
  openPopoverId, setOpenPopoverId, dragOverKey, setDragOverKey,
  onDropAllDay, onDropSlot, onChipDragStart, onChipDragEnd, onRangeSelected, renderPopover,
}: {
  days: Date[]
  hours: number[]
  todayYmd: string
  tasksByDate: Record<string, Task[]>
  members: Member[]
  highlightId: string | null
  openPopoverId: string | null
  setOpenPopoverId: (id: string | null) => void
  dragOverKey: string | null
  setDragOverKey: (k: string | null) => void
  onDropAllDay: (e: React.DragEvent, dayYmd: string) => void
  onDropSlot: (e: React.DragEvent, dayYmd: string, hour: number) => void
  onChipDragStart: (e: React.DragEvent, id: string) => void
  onChipDragEnd: () => void
  onRangeSelected: (selection: QuickAddSelection) => void
  renderPopover: (task: Task, close: () => void) => React.ReactNode
}) {
  // Linha vermelha da hora atual — atualiza a cada minuto, não a cada
  // render, pra não precisar de um relógio "vivo" custando re-render
  // constante no resto do painel.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])
  const nowInHourRange = now.getHours() >= hours[0] && now.getHours() <= hours[hours.length - 1]
  const nowTop = (now.getHours() - hours[0]) * ROW_H + (now.getMinutes() / 60) * ROW_H

  // Seleção por arraste — ver comentário do arquivo.
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
    // Não inicia seleção ao clicar numa tarefa existente (o chip cuida do
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
      {/* Cabeçalho dos dias — colunas de largura fixa (minmax(0,1fr)): texto
          de tarefa nunca pode forçar uma coluna a crescer além disso. */}
      <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b">
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
      <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b bg-muted/10">
        <div className="text-[10px] text-muted-foreground px-1.5 py-2 uppercase tracking-wide">Dia inteiro</div>
        {days.map(d => {
          const key = ymd(d)
          const allDay = (tasksByDate[key] || []).filter(t => !dueTimeOnly(t.due_date))
          const isDragOver = dragOverKey === `allday:${key}`
          return (
            <div
              key={key}
              onDragOver={e => { e.preventDefault(); setDragOverKey(`allday:${key}`) }}
              onDragLeave={() => setDragOverKey(null)}
              onDrop={e => onDropAllDay(e, key)}
              className={cn('border-l px-1 py-1.5 space-y-0.5 min-h-[36px] min-w-0', isDragOver && 'bg-primary/5 ring-2 ring-inset ring-primary/40')}
            >
              {allDay.map(t => (
                <CalendarTaskChip
                  key={t.id}
                  task={t}
                  members={members}
                  highlighted={highlightId === t.id}
                  open={openPopoverId === t.id}
                  onOpenChange={o => setOpenPopoverId(o ? t.id : null)}
                  onDragStart={e => onChipDragStart(e, t.id)}
                  onDragEnd={onChipDragEnd}
                  renderPopover={close => renderPopover(t, close)}
                />
              ))}
            </div>
          )
        })}
      </div>

      {/* Timeline */}
      <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] relative select-none">
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
          const timed = (tasksByDate[key] || []).filter(t => dueTimeOnly(t.due_date))
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
                <div
                  className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                  style={{ top: nowTop }}
                >
                  <span className="w-2 h-2 -ml-1 rounded-full bg-red-500 shrink-0" />
                  <div className="h-px flex-1 bg-red-500" />
                </div>
              )}

              {/* Tarefas com horário, posicionadas proporcionalmente — com
                  duração, o bloco ocupa a altura correspondente (funciona
                  como agenda); sem duração, cai numa linha só (altura do
                  chip, sem esticar). */}
              {timed.map((t, _idx) => {
                const time = dueTimeOnly(t.due_date)!
                const [hh, mm] = time.split(':').map(Number)
                const top = (hh - hours[0]) * ROW_H + (mm / 60) * ROW_H
                const height = t.duration_minutes ? (t.duration_minutes / 60) * ROW_H : undefined
                const overlap = timed.filter(o => dueTimeOnly(o.due_date) === time).length
                const overlapIdx = timed.filter(o => dueTimeOnly(o.due_date) === time).indexOf(t)
                return (
                  <div
                    key={t.id}
                    data-quickadd-ignore
                    style={{ top, height, left: overlap > 1 ? `${(overlapIdx / overlap) * 100}%` : 0, width: overlap > 1 ? `${100 / overlap}%` : '100%' }}
                    className="absolute px-0.5 z-10"
                  >
                    <div className="h-full">
                      <CalendarTaskChip
                        expanded={height != null}
                        task={t}
                        members={members}
                        highlighted={highlightId === t.id}
                        open={openPopoverId === t.id}
                        onOpenChange={o => setOpenPopoverId(o ? t.id : null)}
                        onDragStart={e => onChipDragStart(e, t.id)}
                        onDragEnd={onChipDragEnd}
                        renderPopover={close => renderPopover(t, close)}
                      />
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
