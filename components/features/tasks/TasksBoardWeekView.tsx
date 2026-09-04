'use client'

/**
 * Week-timeline calendar view for TasksBoard. Split out of
 * TasksBoardCalendarViews.tsx — prop-driven, none of this reads
 * TasksBoard's local state directly.
 */

import { cn } from '@/lib/utils'
import { WEEKDAYS_PT, ROW_H, ymd, dueTimeOnly, type Task, type Member } from './TasksBoardShared'
import { CalendarTaskChip } from './TasksBoardCalendarViews'

export function WeekTimeline({
  days, hours, todayYmd, tasksByDate, members, highlightId,
  openPopoverId, setOpenPopoverId, dragOverKey, setDragOverKey,
  onDropAllDay, onDropSlot, onChipDragStart, onChipDragEnd, onQuickAdd, renderPopover,
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
  onQuickAdd: (d: string, t?: string) => void
  renderPopover: (task: Task, close: () => void) => React.ReactNode
}) {
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
      <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] relative">
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
          return (
            <div key={key} className="relative border-l min-w-0">
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
                    onDoubleClick={() => onQuickAdd(key, `${String(h).padStart(2, '0')}:00`)}
                    className={cn('border-b border-border/60', isDragOver && 'bg-primary/5')}
                  />
                )
              })}

              {/* Tarefas com horário, posicionadas proporcionalmente */}
              {timed.map((t, _idx) => {
                const time = dueTimeOnly(t.due_date)!
                const [hh, mm] = time.split(':').map(Number)
                const top = (hh - hours[0]) * ROW_H + (mm / 60) * ROW_H
                const overlap = timed.filter(o => dueTimeOnly(o.due_date) === time).length
                const overlapIdx = timed.filter(o => dueTimeOnly(o.due_date) === time).indexOf(t)
                return (
                  <div
                    key={t.id}
                    style={{ top, left: overlap > 1 ? `${(overlapIdx / overlap) * 100}%` : 0, width: overlap > 1 ? `${100 / overlap}%` : '100%' }}
                    className="absolute px-0.5 z-10"
                  >
                    <CalendarTaskChip
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
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
