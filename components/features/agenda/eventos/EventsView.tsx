'use client'

/** Orquestrador de Agenda → Eventos — mês (grade de chips), semana e dia
 *  (timeline por hora estilo Google Agenda, EventsWeekTimeline). Busca a
 *  janela de eventos correspondente (listEventsForRange, server action
 *  chamada direto do client, mesmo padrão de RelatedEntityCombobox.tsx) e
 *  abre o EventDialog/EventQuickCreatePopover pra criar/editar. Só eventos
 *  aqui — Tarefas não aparece (separação pedida explicitamente, set/2026). */

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ActionButton as Button } from '@/components/features/ActionButton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { addDays, addMonths, addWeeks, startOfMonth, startOfWeek, ymd } from '@/components/features/tasks/TasksBoardShared'
import { listEventsForRange, type EventRow } from '@/actions/events'
import { rangeForView, groupEventsByDay, computeHourRange, type CalView } from './EventsShared'
import EventsMonthGrid from './EventsMonthGrid'
import EventsWeekTimeline from './EventsWeekTimeline'
import EventDialog from './EventDialog'
import { EventQuickCreatePopover, type EventRangeSelection } from './EventQuickCreatePopover'
import AgendaCreateMenu from './AgendaCreateMenu'
import { useEventsCalendarMutations } from './useEventsCalendarMutations'

type Member = { user_id: string; name: string; email: string }

export default function EventsView({
  orgSlug, initialEvents, members = [], niche, canCreateTasks = true,
}: {
  orgSlug: string
  initialEvents: EventRow[]
  members?: Member[]
  niche?: string | null
  canCreateTasks?: boolean
}) {
  const [view, setView] = useState<CalView>('month')
  const [anchor, setAnchor] = useState(() => new Date())
  const [events, setEvents] = useState<EventRow[]>(initialEvents)
  const [editing, setEditing] = useState<EventRow | null>(null)
  const [quickAddDate, setQuickAddDate] = useState<string | null>(null)
  const [quickAddTime, setQuickAddTime] = useState<string | undefined>(undefined)
  const [quickAddRange, setQuickAddRange] = useState<EventRangeSelection | null>(null)
  const requestId = useRef(0)

  async function refetch() {
    const id = ++requestId.current
    const range = rangeForView(view, anchor)
    const data = await listEventsForRange(orgSlug, range)
    if (requestId.current === id) setEvents(data)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { refetch() }, [orgSlug, view, anchor])

  const {
    dragOverKey, setDragOverKey, onChipDragStart, onChipDragEnd, handleDropOnSlot, handleDropOnAllDay,
  } = useEventsCalendarMutations({ orgSlug, events, setEvents, onChanged: refetch })

  const eventsByDay = useMemo(() => groupEventsByDay(events), [events])
  const todayYmd = ymd(new Date())

  const monthDays = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(anchor))
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
  }, [anchor])
  const weekDays = useMemo(() => {
    const start = startOfWeek(anchor)
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }, [anchor])
  const timelineDays = weekDays
  const hourRange = useMemo(() => computeHourRange(timelineDays, eventsByDay), [timelineDays, eventsByDay])
  const hours = useMemo(
    () => Array.from({ length: hourRange.end - hourRange.start + 1 }, (_, i) => hourRange.start + i),
    [hourRange],
  )

  function navPrev() {
    setAnchor(a => view === 'month' ? addMonths(a, -1) : addWeeks(a, -1))
  }
  function navNext() {
    setAnchor(a => view === 'month' ? addMonths(a, 1) : addWeeks(a, 1))
  }

  const rangeLabel = view === 'month'
    ? anchor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    : `${weekDays[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – ${weekDays[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={navPrev} aria-label="Anterior">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={() => setAnchor(new Date())}>Hoje</Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={navNext} aria-label="Próximo">
            <ChevronRight className="w-4 h-4" />
          </Button>
          <span className="ml-2 text-sm font-medium capitalize">{rangeLabel}</span>
        </div>

        <div className="flex items-center gap-2">
          <Select value={view} onValueChange={v => setView(v as CalView)}>
            <SelectTrigger className="w-[110px] h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Mês</SelectItem>
              <SelectItem value="week">Semana</SelectItem>
            </SelectContent>
          </Select>
          <AgendaCreateMenu orgSlug={orgSlug} members={members} niche={niche} defaultDate={ymd(anchor)} onEventSaved={refetch} canCreateTasks={canCreateTasks} />
        </div>
      </div>

      <div className="min-h-[420px]">
        {view === 'month' ? (
          <EventsMonthGrid
            days={monthDays}
            calMonth={startOfMonth(anchor)}
            todayYmd={todayYmd}
            eventsByDay={eventsByDay}
            onDayClick={d => setQuickAddDate(d)}
            onOpenEvent={setEditing}
          />
        ) : (
          <EventsWeekTimeline
            days={timelineDays}
            hours={hours}
            todayYmd={todayYmd}
            eventsByDay={eventsByDay}
            dragOverKey={dragOverKey}
            setDragOverKey={setDragOverKey}
            onDropAllDay={handleDropOnAllDay}
            onDropSlot={handleDropOnSlot}
            onChipDragStart={onChipDragStart}
            onChipDragEnd={onChipDragEnd}
            onRangeSelected={setQuickAddRange}
            onOpenEvent={setEditing}
          />
        )}
      </div>

      <EventDialog
        orgSlug={orgSlug}
        members={members}
        niche={niche}
        event={editing}
        open={!!editing}
        onOpenChange={o => !o && setEditing(null)}
        onSaved={refetch}
        onDeleted={refetch}
      />

      <EventDialog
        orgSlug={orgSlug}
        members={members}
        niche={niche}
        defaultDate={quickAddDate || undefined}
        defaultTime={quickAddTime}
        open={!!quickAddDate}
        onOpenChange={o => { if (!o) { setQuickAddDate(null); setQuickAddTime(undefined) } }}
        onSaved={refetch}
      />

      {quickAddRange && (
        <EventQuickCreatePopover
          orgSlug={orgSlug}
          selection={quickAddRange}
          onClose={() => setQuickAddRange(null)}
          onSaved={refetch}
          onMoreOptions={(day, time) => {
            setQuickAddRange(null)
            setQuickAddDate(day)
            setQuickAddTime(time)
          }}
        />
      )}
    </div>
  )
}
