'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Calendar as MiniCalendar } from '@/components/ui/calendar'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ClinicAppointmentContext } from '@/actions/clinic'
import type { ClinicStatus } from '@/lib/clinic-constants'
import type { CalendarAppointment, ClinicOption, Availability, ClinicFinalizePayment } from './AppointmentsCalendarShared'
import {
  MONTH_NAMES,
  DAY_NAMES_LONG,
  startOfWeek,
  addDays,
  computeHourRange,
  computeAvailableDays,
} from './AppointmentsCalendarShared'
import { WeekView } from './AppointmentsCalendarWeekView'
import { DayProfessionalView } from './AppointmentsCalendarDayView'
import { MonthView } from './AppointmentsCalendarMonthView'
import { AppointmentsCalendarDetailDialog } from './AppointmentsCalendarDetailDialog'
import { AppointmentsCalendarFinalizeDialog, type FinalizeForm } from './AppointmentsCalendarFinalizeDialog'

export type { CalendarAppointment, ClinicFinalizePayment }

type Mode = 'week' | 'month' | 'day'

type Props = {
  orgSlug: string
  appointments: CalendarAppointment[]
  mode: Mode
  onCancel: (a: CalendarAppointment) => void
  onComplete: (a: CalendarAppointment) => void
  /** Só usado no modo 'day' (Agenda do dia, uma coluna por profissional) —
   *  nicho Clínicas. Nos demais modos/nichos ficam vazios/ignorados. */
  clinicProfessionals?: ClinicOption[]
  /** Nomes de especialidade, pra exibir no popup de detalhe do profissional
   *  (agenda do dia) — só o id fica em clinicProfessionals.specialty_id. */
  clinicSpecialties?: ClinicOption[]
  clinicContexts?: Record<string, ClinicAppointmentContext>
  /** Duplo clique num horário vazio (Semana/Dia) — abre o diálogo de novo
   *  agendamento prefilled. Sem isso os horários vazios não são clicáveis. */
  onSlotDoubleClick?: (date: Date, time: string, professionalId?: string) => void
  /** Horários configurados em "Horários disponíveis" — usados pra restringir
   *  Semana/Dia aos dias da semana e à faixa de horário realmente atendidos,
   *  em vez de sempre mostrar todos os 7 dias e a janela fixa 7h–21h. Sem
   *  nenhum horário configurado ainda, cai no fallback (todos os dias, 7–21h). */
  availabilities?: Availability[]
  /** Nicho Clínicas — habilita os botões rápidos de avançar estágio
   *  (Confirmar/Iniciar atendimento/Concluir/Não compareceu) e "Agendar
   *  retorno" no popup de detalhe do agendamento. */
  isClinic?: boolean
  onClinicStatusChange?: (a: CalendarAppointment, status: ClinicStatus, payment?: ClinicFinalizePayment) => void
  onScheduleReturn?: (a: CalendarAppointment) => void
}

/* -------- Main calendar shell with navigation + detail dialog -------- */

export default function AppointmentsCalendar({
  orgSlug,
  appointments,
  mode,
  onCancel,
  onComplete,
  clinicProfessionals = [],
  clinicSpecialties = [],
  clinicContexts = {},
  availabilities = [],
  onSlotDoubleClick,
  isClinic = false,
  onClinicStatusChange,
  onScheduleReturn,
}: Props) {
  const [cursor, setCursor] = useState(() => new Date())
  const [selected, setSelected] = useState<CalendarAppointment | null>(null)

  // Filtros de Semana/Mês (Dia já filtra por profissional via colunas) —
  // profissional específico e/ou só atrasados (horário já passou mas o
  // paciente ainda não chegou, nem foi cancelado/marcado como falta).
  const [professionalFilter, setProfessionalFilter] = useState<string>('all')
  const [overdueOnly, setOverdueOnly] = useState(false)

  const isOverdue = (a: CalendarAppointment) => {
    const status = clinicContexts[a.id]?.clinic_status
    const notStartedYet = !status || ['aguardando_confirmacao', 'agendado', 'confirmado', 'reagendado'].includes(status)
    return notStartedYet && new Date(a.start_time).getTime() < Date.now()
  }

  const filteredAppointments = useMemo(() => {
    let rows = appointments
    if (professionalFilter !== 'all') {
      rows = rows.filter(a => clinicContexts[a.id]?.professional_id === professionalFilter)
    }
    if (overdueOnly) {
      rows = rows.filter(isOverdue)
    }
    return rows
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointments, professionalFilter, overdueOnly, clinicContexts])

  const overdueCount = useMemo(() => appointments.filter(isOverdue).length, [appointments, clinicContexts])

  // Diálogo de "Finalizar atendimento" — captura valor/forma de pagamento/
  // parcelas antes de avançar o status pra 'realizado', em vez de sempre
  // cair no preço de tabela do procedimento.
  const [finalizeTarget, setFinalizeTarget] = useState<CalendarAppointment | null>(null)
  const [finalizeForm, setFinalizeForm] = useState<FinalizeForm>({ total: '', discount: '', paymentMethod: '', installments: '' })

  function openFinalizeDialog(appt: CalendarAppointment) {
    setFinalizeTarget(appt)
    setFinalizeForm({ total: '', discount: '', paymentMethod: '', installments: '' })
  }

  function submitFinalize(e: React.FormEvent) {
    e.preventDefault()
    if (!finalizeTarget || !onClinicStatusChange) return
    onClinicStatusChange(finalizeTarget, 'realizado', {
      total_cents: finalizeForm.total ? Math.round(parseFloat(finalizeForm.total.replace(',', '.')) * 100) : undefined,
      discount_cents: finalizeForm.discount ? Math.round(parseFloat(finalizeForm.discount.replace(',', '.')) * 100) : undefined,
      payment_method: finalizeForm.paymentMethod || undefined,
      installments: finalizeForm.paymentMethod === 'credito' && finalizeForm.installments ? Number(finalizeForm.installments) : undefined,
    })
    setFinalizeTarget(null)
    setSelected(null)
  }

  const hourRange = useMemo(() => computeHourRange(availabilities), [availabilities])
  const availableDays = useMemo(() => computeAvailableDays(availabilities), [availabilities])

  const range = useMemo(() => {
    if (mode === 'week') {
      const start = startOfWeek(cursor)
      const end = addDays(start, 6)
      return { start, end }
    }
    if (mode === 'day') {
      const start = new Date(cursor)
      start.setHours(0, 0, 0, 0)
      return { start, end: start }
    }
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
    return { start, end }
  }, [cursor, mode])

  function go(direction: number) {
    const next = new Date(cursor)
    if (mode === 'week') next.setDate(next.getDate() + 7 * direction)
    else if (mode === 'day') next.setDate(next.getDate() + direction)
    else next.setMonth(next.getMonth() + direction)
    setCursor(next)
  }

  function goToday() {
    setCursor(new Date())
  }

  const label = useMemo(() => {
    if (mode === 'week') {
      const s = range.start
      const e = range.end
      const sameMonth = s.getMonth() === e.getMonth()
      const sameYear = s.getFullYear() === e.getFullYear()
      if (sameMonth) {
        return `${s.getDate()}–${e.getDate()} de ${MONTH_NAMES[s.getMonth()]} ${e.getFullYear()}`
      }
      if (sameYear) {
        return `${s.getDate()} ${MONTH_NAMES[s.getMonth()].slice(0, 3)} – ${e.getDate()} ${MONTH_NAMES[e.getMonth()].slice(0, 3)} ${e.getFullYear()}`
      }
      return `${s.getDate()} ${MONTH_NAMES[s.getMonth()].slice(0, 3)} ${s.getFullYear()} – ${e.getDate()} ${MONTH_NAMES[e.getMonth()].slice(0, 3)} ${e.getFullYear()}`
    }
    if (mode === 'day') {
      return `${DAY_NAMES_LONG[range.start.getDay()]}, ${range.start.getDate()} de ${MONTH_NAMES[range.start.getMonth()]} ${range.start.getFullYear()}`
    }
    return `${MONTH_NAMES[range.start.getMonth()]} ${range.start.getFullYear()}`
  }, [range, mode])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => go(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToday}>
            Hoje
          </Button>
          <Button variant="outline" size="sm" onClick={() => go(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <h2 className="text-sm font-semibold capitalize">{label}</h2>
        <div className="w-[120px]" /> {/* spacer to balance the row */}
      </div>

      {(mode === 'week' || mode === 'month') && clinicProfessionals.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={professionalFilter}
            onChange={e => setProfessionalFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="all">Todos os profissionais</option>
            {clinicProfessionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <Button
            type="button"
            variant={overdueOnly ? 'default' : 'outline'}
            size="sm"
            className="h-8 text-xs"
            onClick={() => setOverdueOnly(v => !v)}
          >
            Atrasados{overdueCount > 0 ? ` (${overdueCount})` : ''}
          </Button>
        </div>
      )}

      {mode === 'week' ? (
        <WeekView
          orgSlug={orgSlug}
          weekStart={range.start}
          appointments={filteredAppointments}
          onSelect={setSelected}
          hourRange={hourRange}
          availableDays={availableDays}
          onSlotDoubleClick={onSlotDoubleClick}
        />
      ) : mode === 'day' ? (
        <div className="flex gap-3 items-start">
          <div className="hidden lg:block shrink-0">
            <MiniCalendar
              mode="single"
              selected={cursor}
              onSelect={d => d && setCursor(d)}
              className="border rounded-lg bg-card p-2"
            />
          </div>
          <div className="flex-1 min-w-0">
            <DayProfessionalView
              day={range.start}
              appointments={appointments}
              professionals={clinicProfessionals}
              clinicSpecialties={clinicSpecialties}
              contexts={clinicContexts}
              onSelect={setSelected}
              hourRange={hourRange}
              onSlotDoubleClick={onSlotDoubleClick}
            />
          </div>
        </div>
      ) : (
        <MonthView monthStart={range.start} appointments={filteredAppointments} onSelect={setSelected} availableDays={availableDays} />
      )}

      <AppointmentsCalendarDetailDialog
        orgSlug={orgSlug}
        selected={selected}
        setSelected={setSelected}
        clinicContexts={clinicContexts}
        isClinic={isClinic}
        onCancel={onCancel}
        onComplete={onComplete}
        onClinicStatusChange={onClinicStatusChange}
        onScheduleReturn={onScheduleReturn}
        openFinalizeDialog={openFinalizeDialog}
      />

      <AppointmentsCalendarFinalizeDialog
        finalizeTarget={finalizeTarget}
        setFinalizeTarget={setFinalizeTarget}
        finalizeForm={finalizeForm}
        setFinalizeForm={setFinalizeForm}
        submitFinalize={submitFinalize}
      />
    </div>
  )
}
