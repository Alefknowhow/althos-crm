'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Calendar, CalendarDays, CalendarRange, List as ListIcon, Users } from 'lucide-react'
import { cancelAppointment, markAppointmentCompleted } from '@/actions/appointments'
import { setClinicAppointmentStatus, type ClinicAppointmentContext, type ClinicServiceContext } from '@/actions/clinic'
import { type ClinicStatus } from '@/lib/clinic-constants'
import AppointmentsCalendar, {
  type CalendarAppointment, type ClinicFinalizePayment,
} from './AppointmentsCalendar'
import NewAppointmentDialog, { type AppointmentPrefill } from './NewAppointmentDialog'
import { AppointmentRow } from './AppointmentRow'

type Appointment = CalendarAppointment

type ClinicOption = { id: string; name: string }
type Availability = { id: string; day_of_week: number; start_time: string; end_time: string; event_type_id: string | null }

type Props = {
  orgSlug: string
  upcoming: Appointment[]
  past: Appointment[]
  eventTypes: { id: string; name: string; duration_minutes: number; color: string | null }[]
  isClinic?: boolean
  clinicProfessionals?: ClinicOption[]
  clinicSpecialties?: ClinicOption[]
  clinicRooms?: ClinicOption[]
  clinicContexts?: Record<string, ClinicAppointmentContext>
  clinicServiceContexts?: Record<string, ClinicServiceContext>
  availabilities?: Availability[]
}

export default function AppointmentsListPanel({
  orgSlug, upcoming, past, eventTypes,
  isClinic = false, clinicProfessionals = [], clinicSpecialties = [], clinicRooms = [], clinicContexts = {}, clinicServiceContexts = {}, availabilities = [],
}: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState<'week' | 'month' | 'list' | 'day'>('week')
  const professionalNameById = new Map(clinicProfessionals.map(p => [p.id, p.name]))

  // Duplo clique num horário vazio (Semana/Dia) ou "Agendar retorno" a
  // partir de um agendamento existente — os dois abrem o mesmo diálogo de
  // novo agendamento, só muda o que vem preenchido.
  const [quickCreate, setQuickCreate] = useState<AppointmentPrefill | null>(null)

  function handleSlotDoubleClick(date: Date, time: string, professionalId?: string) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    setQuickCreate({ date: `${y}-${m}-${d}`, time, professionalId })
  }

  function handleScheduleReturn(a: Appointment) {
    // Sugere 14 dias após a última consulta como ponto de partida — o
    // operador ajusta a data/hora certa no diálogo antes de confirmar.
    const suggested = new Date(a.start_time)
    suggested.setDate(suggested.getDate() + 14)
    const y = suggested.getFullYear()
    const m = String(suggested.getMonth() + 1).padStart(2, '0')
    const d = String(suggested.getDate()).padStart(2, '0')
    setQuickCreate({
      date: `${y}-${m}-${d}`,
      time: new Date(a.start_time).toTimeString().slice(0, 5),
      professionalId: clinicContexts[a.id]?.professional_id || undefined,
      guestName: a.guest_name,
      guestEmail: a.guest_email,
      guestPhone: a.guest_phone,
    })
  }

  async function handleClinicStatusChange(a: Appointment, status: ClinicStatus, payment?: ClinicFinalizePayment) {
    const res = await setClinicAppointmentStatus(orgSlug, a.id, status, payment)
    if (res.ok) {
      toast.success('Status atualizado')
      startTransition(() => router.refresh())
    } else {
      toast.error(res.error)
    }
  }

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
                  isClinic={isClinic}
                  clinicContext={clinicContexts[a.id]}
                  professionalName={clinicContexts[a.id]?.professional_id ? professionalNameById.get(clinicContexts[a.id].professional_id!) : null}
                  onClinicStatusChange={handleClinicStatusChange}
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
      {/* Top bar: view toggle + new appointment — sticky logo abaixo das abas
          (que já são sticky, 56px de altura), pra só a área de
          calendário/agenda/lista rolar por baixo dos dois. */}
      <div className="sticky top-14 z-10 -mx-3 sm:-mx-5 px-3 sm:px-5 py-3 bg-background border-b flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1 w-fit">
          {isClinic && clinicProfessionals.length > 0 && (
            <button
              type="button"
              onClick={() => setView('day')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md inline-flex items-center gap-1.5 transition-colors ${
                view === 'day'
                  ? 'bg-background   text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Users className="w-3.5 h-3.5" /> Agenda do dia
            </button>
          )}
          <button
            type="button"
            onClick={() => setView('week')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md inline-flex items-center gap-1.5 transition-colors ${
              view === 'week'
                ? 'bg-background   text-foreground'
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
                ? 'bg-background   text-foreground'
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
                ? 'bg-background   text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ListIcon className="w-3.5 h-3.5" /> Lista
          </button>
        </div>

        <NewAppointmentDialog
          orgSlug={orgSlug}
          eventTypes={eventTypes}
          isClinic={isClinic}
          clinicProfessionals={clinicProfessionals}
          clinicRooms={clinicRooms}
          clinicServiceContexts={clinicServiceContexts}
        />
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
          clinicProfessionals={clinicProfessionals}
          clinicSpecialties={clinicSpecialties}
          clinicContexts={clinicContexts}
          availabilities={availabilities}
          onSlotDoubleClick={handleSlotDoubleClick}
          isClinic={isClinic}
          onClinicStatusChange={handleClinicStatusChange}
          onScheduleReturn={isClinic ? handleScheduleReturn : undefined}
        />
      )}

      {/* Diálogo controlado — aberto pelo duplo clique num horário vazio ou
          por "Agendar retorno" no popup de detalhe (ver AppointmentsCalendar). */}
      <NewAppointmentDialog
        orgSlug={orgSlug}
        eventTypes={eventTypes}
        isClinic={isClinic}
        clinicProfessionals={clinicProfessionals}
        clinicRooms={clinicRooms}
        clinicServiceContexts={clinicServiceContexts}
        hideTrigger
        open={quickCreate !== null}
        onOpenChange={o => !o && setQuickCreate(null)}
        prefill={quickCreate}
      />
    </div>
  )
}
