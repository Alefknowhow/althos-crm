'use client'

/** Orquestrador da visão Calendário (Agenda → Calendário, issue #14) —
 *  alterna mês/semana/dia, busca a janela de eventos correspondente
 *  (listEventsForRange, server action chamada direto do client, mesmo
 *  padrão de RelatedEntityCombobox.tsx) e abre o EventDialog pra criar/editar. */

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ActionButton as Button } from '@/components/features/ActionButton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { addDays, addMonths, addWeeks, startOfMonth, startOfWeek, ymd } from '@/components/features/tasks/TasksBoardShared'
import { listEventsForRange, type EventRow } from '@/actions/events'
import { rangeForView, groupEventsByDay, type CalView } from './CalendarShared'
import CalendarMonthGrid from './CalendarMonthGrid'
import CalendarWeekGrid from './CalendarWeekGrid'
import CalendarDayList from './CalendarDayList'
import EventDialog from './EventDialog'
import AgendaCreateMenu from './AgendaCreateMenu'

type Member = { user_id: string; name: string; email: string }

export default function CalendarView({
  orgSlug, initialEvents, members = [], niche,
}: {
  orgSlug: string
  initialEvents: EventRow[]
  members?: Member[]
  niche?: string | null
}) {
  const [view, setView] = useState<CalView>('month')
  const [anchor, setAnchor] = useState(() => new Date())
  const [events, setEvents] = useState<EventRow[]>(initialEvents)
  const [editing, setEditing] = useState<EventRow | null>(null)
  const [quickAddDate, setQuickAddDate] = useState<string | null>(null)
  const requestId = useRef(0)

  async function refetch() {
    const id = ++requestId.current
    const range = rangeForView(view, anchor)
    const data = await listEventsForRange(orgSlug, range)
    if (requestId.current === id) setEvents(data)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { refetch() }, [orgSlug, view, anchor])

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

  function navPrev() {
    setAnchor(a => view === 'month' ? addMonths(a, -1) : view === 'week' ? addWeeks(a, -1) : addDays(a, -1))
  }
  function navNext() {
    setAnchor(a => view === 'month' ? addMonths(a, 1) : view === 'week' ? addWeeks(a, 1) : addDays(a, 1))
  }

  const rangeLabel = view === 'month'
    ? anchor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    : view === 'week'
      ? `${weekDays[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – ${weekDays[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`
      : anchor.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

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
              <SelectItem value="day">Dia</SelectItem>
            </SelectContent>
          </Select>
          <AgendaCreateMenu orgSlug={orgSlug} members={members} niche={niche} defaultDate={ymd(anchor)} onEventSaved={refetch} />
        </div>
      </div>

      <div className="min-h-[420px]">
        {view === 'month' && (
          <CalendarMonthGrid
            days={monthDays}
            calMonth={startOfMonth(anchor)}
            todayYmd={todayYmd}
            eventsByDay={eventsByDay}
            onDayClick={d => setQuickAddDate(d)}
            onOpenEvent={setEditing}
          />
        )}
        {view === 'week' && (
          <CalendarWeekGrid
            weekDays={weekDays}
            todayYmd={todayYmd}
            eventsByDay={eventsByDay}
            onDayClick={d => setQuickAddDate(d)}
            onOpenEvent={setEditing}
          />
        )}
        {view === 'day' && (
          <CalendarDayList
            day={anchor}
            events={eventsByDay.get(ymd(anchor)) || []}
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
        open={!!quickAddDate}
        onOpenChange={o => !o && setQuickAddDate(null)}
        onSaved={refetch}
      />
    </div>
  )
}
