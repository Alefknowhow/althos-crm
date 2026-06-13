'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Calendar, ExternalLink, X, Check, CalendarDays, CalendarRange, List as ListIcon } from 'lucide-react'
import { cancelAppointment, markAppointmentCompleted } from '@/actions/appointments'
import AppointmentsCalendar, {
  type CalendarAppointment,
} from './AppointmentsCalendar'
import NewAppointmentDialog from './NewAppointmentDialog'

type Appointment = CalendarAppointment

type Props = {
  orgSlug: string
  upcoming: Appointment[]
  past: Appointment[]
  eventTypes: { id: string; name: string; duration_minutes: number; color: string | null }[]
}

function pickFirst<T>(x: T | T[] | null | undefined): T | null {
  if (!x) return null
  return Array.isArray(x) ? x[0] || null : x
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Agendado',
  canceled: 'Cancelado',
  completed: 'Concluído',
}

const STATUS_STYLE: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700 border-blue-200',
  canceled: 'bg-red-100 text-red-700 border-red-200',
  completed: 'bg-green-100 text-green-700 border-green-200',
}

function AppointmentRow({
  orgSlug,
  appt,
  onCancel,
  onComplete,
  loading,
}: {
  orgSlug: string
  appt: Appointment
  onCancel: (a: Appointment) => void
  onComplete: (a: Appointment) => void
  loading: boolean
}) {
  const et = pickFirst(appt.event_types)
  const lead = pickFirst(appt.leads)
  return (
    <TableRow>
      <TableCell className="whitespace-nowrap text-sm">{formatDateTime(appt.start_time)}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          {et?.color && (
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: et.color }} />
          )}
          <div>
            <div className="text-sm font-medium">{et?.name || '—'}</div>
            <div className="text-xs text-muted-foreground">{et?.duration_minutes} min</div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="text-sm">{appt.guest_name}</div>
        <div className="text-xs text-muted-foreground">{appt.guest_email}</div>
      </TableCell>
      <TableCell>
        <Badge className={STATUS_STYLE[appt.status]}>{STATUS_LABEL[appt.status]}</Badge>
        {appt.canceled_reason && (
          <div className="text-[10px] text-muted-foreground mt-1 max-w-[180px] truncate">
            {appt.canceled_reason}
          </div>
        )}
      </TableCell>
      <TableCell>
        {lead?.id ? (
          <Link
            href={`/app/${orgSlug}/contatos/${lead.id}`}
            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
          >
            {lead.name} <ExternalLink className="w-3 h-3" />
          </Link>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        {appt.status === 'scheduled' && (
          <div className="flex gap-1 justify-end">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onComplete(appt)}
              disabled={loading}
              title="Marcar como concluído"
            >
              <Check className="w-3.5 h-3.5 text-green-600" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onCancel(appt)}
              disabled={loading}
              title="Cancelar"
              className="text-destructive hover:bg-destructive/10"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </TableCell>
    </TableRow>
  )
}

export default function AppointmentsListPanel({ orgSlug, upcoming, past, eventTypes }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState<'week' | 'month' | 'list'>('week')

  // Unified list for calendar (it filters by date range itself).
  const all = useMemo(() => [...upcoming, ...past], [upcoming, past])

  async function handleCancel(a: Appointment) {
    const reason = window.prompt('Motivo do cancelamento? (opcional)') || ''
    setLoading(true)
    const res = await cancelAppointment(orgSlug, a.id, reason)
    setLoading(false)
    if (res.ok) {
      toast.success('Agendamento cancelado')
      startTransition(() => router.refresh())
    } else {
      toast.error(res.error)
    }
  }

  async function handleComplete(a: Appointment) {
    setLoading(true)
    const res = await markAppointmentCompleted(orgSlug, a.id)
    setLoading(false)
    if (res.ok) {
      toast.success('Marcado como concluído')
      startTransition(() => router.refresh())
    } else {
      toast.error(res.error)
    }
  }

  function renderTable(list: Appointment[]) {
    if (list.length === 0) {
      return (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            <Calendar className="w-10 h-10 mx-auto opacity-40 mb-3" />
            <p>Nenhum agendamento.</p>
          </CardContent>
        </Card>
      )
    }
    return (
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Lead</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map(a => (
                <AppointmentRow
                  key={a.id}
                  orgSlug={orgSlug}
                  appt={a}
                  onCancel={handleCancel}
                  onComplete={handleComplete}
                  loading={loading}
                />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Top bar: view toggle + new appointment */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1 w-fit">
          <button
            type="button"
            onClick={() => setView('week')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md inline-flex items-center gap-1.5 transition-colors ${
              view === 'week'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <CalendarRange className="w-3.5 h-3.5" /> Semana
          </button>
          <button
            type="button"
            onClick={() => setView('month')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md inline-flex items-center gap-1.5 transition-colors ${
              view === 'month'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" /> Mês
          </button>
          <button
            type="button"
            onClick={() => setView('list')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md inline-flex items-center gap-1.5 transition-colors ${
              view === 'list'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ListIcon className="w-3.5 h-3.5" /> Lista
          </button>
        </div>

        <NewAppointmentDialog orgSlug={orgSlug} eventTypes={eventTypes} />
      </div>

      {view === 'list' ? (
        <Tabs defaultValue="upcoming" className="space-y-4">
          <TabsList>
            <TabsTrigger value="upcoming">Próximos ({upcoming.length})</TabsTrigger>
            <TabsTrigger value="past">Passados ({past.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="upcoming">{renderTable(upcoming)}</TabsContent>
          <TabsContent value="past">{renderTable(past)}</TabsContent>
        </Tabs>
      ) : (
        <AppointmentsCalendar
          orgSlug={orgSlug}
          appointments={all}
          mode={view}
          onCancel={handleCancel}
          onComplete={handleComplete}
        />
      )}
    </div>
  )
}
