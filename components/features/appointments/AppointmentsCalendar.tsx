'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ChevronLeft, ChevronRight, X, Check, MapPin, Mail, Phone, ExternalLink, CalendarPlus, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import type { ClinicAppointmentContext } from '@/actions/clinic'
import { CLINIC_STATUS_LABEL, type ClinicStatus } from '@/lib/clinic-constants'
import { Calendar as MiniCalendar } from '@/components/ui/calendar'
import type { CalendarAppointment, ClinicOption, Availability } from './AppointmentsCalendarShared'
import {
  pickFirst,
  DAY_NAMES_LONG,
  MONTH_NAMES,
  startOfWeek,
  addDays,
  computeHourRange,
  computeAvailableDays,
} from './AppointmentsCalendarShared'
import { WeekView } from './AppointmentsCalendarWeekView'
import { DayProfessionalView } from './AppointmentsCalendarDayView'
import { MonthView } from './AppointmentsCalendarMonthView'

export type { CalendarAppointment }

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

/** Valor/forma de pagamento/parcelas capturados no momento de finalizar o
 *  atendimento (avançar pra 'realizado') — sobrescreve o preço de tabela
 *  do procedimento quando informado. */
export type ClinicFinalizePayment = {
  total_cents?: number | null
  discount_cents?: number
  payment_method?: string | null
  installments?: number | null
}

// Progressão padrão de status usada por plataformas de agenda consolidadas
// (Doctoralia, Boulevard etc.): um botão primário "próximo passo" por
// status, em vez de expor a máquina de estados inteira de uma vez.
const NEXT_CLINIC_STATUS: Partial<Record<ClinicStatus, ClinicStatus>> = {
  aguardando_confirmacao: 'confirmado',
  agendado: 'confirmado',
  confirmado: 'em_atendimento',
  em_atendimento: 'realizado',
}

// Rótulo do botão de "próximo passo" — mais concreto que o nome cru do
// status (ex.: "Paciente chegou" em vez de "Em atendimento"), pedido
// explicitamente pra refletir o check-in/check-out do dia a dia.
const NEXT_ACTION_LABEL: Partial<Record<ClinicStatus, string>> = {
  confirmado: 'Confirmar',
  em_atendimento: 'Paciente chegou',
  realizado: 'Finalizar atendimento',
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  pix: 'PIX', credito: 'Cartão de Crédito', debito: 'Cartão de Débito',
  dinheiro: 'Dinheiro', boleto: 'Boleto', transferencia: 'Transferência',
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
  const [finalizeForm, setFinalizeForm] = useState({ total: '', discount: '', paymentMethod: '', installments: '' })

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

  const selectedEt = selected ? pickFirst(selected.event_types) : null
  const selectedLead = selected ? pickFirst(selected.leads) : null

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

      <Dialog open={!!selected} onOpenChange={o => !o && setSelected(null)}>
        <DialogContent className="max-w-md">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: selectedEt?.color || '#3b82f6' }}
                  />
                  {selectedEt?.name || 'Agendamento'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Quando</div>
                  <div className="font-medium">
                    {new Date(selected.start_time).toLocaleString('pt-BR', {
                      weekday: 'long',
                      day: '2-digit',
                      month: 'long',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {' · '}
                    {selectedEt?.duration_minutes} min
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">Cliente</div>
                  <div className="font-medium">{selected.guest_name}</div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                    <Mail className="w-3 h-3" /> {selected.guest_email}
                  </div>
                  {selected.guest_phone && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <Phone className="w-3 h-3" /> {selected.guest_phone}
                    </div>
                  )}
                </div>

                {selected.location && (
                  <div>
                    <div className="text-xs text-muted-foreground">Local</div>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-muted-foreground" />
                      <span className="break-words">{selected.location}</span>
                    </div>
                  </div>
                )}

                {selected.notes && (
                  <div>
                    <div className="text-xs text-muted-foreground">Notas do cliente</div>
                    <div className="italic">&quot;{selected.notes}&quot;</div>
                  </div>
                )}

                <div>
                  <Badge
                    className={
                      selected.status === 'scheduled'
                        ? 'bg-blue-100 text-blue-700 border-blue-200'
                        : selected.status === 'completed'
                          ? 'bg-green-100 text-green-700 border-green-200'
                          : 'bg-red-100 text-red-700 border-red-200'
                    }
                  >
                    {selected.status === 'scheduled'
                      ? 'Agendado'
                      : selected.status === 'completed'
                        ? 'Concluído'
                        : 'Cancelado'}
                  </Badge>
                  {selected.canceled_reason && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {selected.canceled_reason}
                    </div>
                  )}
                </div>

                {isClinic && (() => {
                  const ctx = clinicContexts[selected.id]
                  const clinicStatus = ctx?.clinic_status as ClinicStatus | undefined
                  const nextStatus = clinicStatus ? NEXT_CLINIC_STATUS[clinicStatus] : undefined
                  const isTerminal = clinicStatus === 'cancelado' || clinicStatus === 'no_show' || clinicStatus === 'reagendado'
                  return (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1.5">Status clínico</div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">{CLINIC_STATUS_LABEL[clinicStatus || 'agendado']}</Badge>
                        {nextStatus && onClinicStatusChange && (
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              if (nextStatus === 'realizado') {
                                openFinalizeDialog(selected)
                              } else {
                                onClinicStatusChange(selected, nextStatus)
                              }
                            }}
                          >
                            {NEXT_ACTION_LABEL[nextStatus] || CLINIC_STATUS_LABEL[nextStatus]} <ArrowRight className="w-3 h-3 ml-1" />
                          </Button>
                        )}
                        {!isTerminal && clinicStatus !== 'realizado' && onClinicStatusChange && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-muted-foreground"
                            onClick={() => onClinicStatusChange(selected, 'no_show')}
                          >
                            Não compareceu
                          </Button>
                        )}
                      </div>
                      {(ctx?.checked_in_at || ctx?.finished_at) && (
                        <div className="mt-1.5 text-[11px] text-muted-foreground space-x-3">
                          {ctx.checked_in_at && <span>Chegou às {new Date(ctx.checked_in_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>}
                          {ctx.finished_at && <span>Finalizou às {new Date(ctx.finished_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>}
                        </div>
                      )}
                    </div>
                  )
                })()}

                {selectedLead?.id && (
                  <Link
                    href={`/app/${orgSlug}/contatos/${selectedLead.id}`}
                    className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
                  >
                    Abrir lead ({selectedLead.name}) <ExternalLink className="w-3 h-3" />
                  </Link>
                )}
              </div>

              {(selected.status === 'scheduled' || (isClinic && onScheduleReturn)) && (
                <DialogFooter className="flex sm:justify-between gap-2 flex-wrap">
                  <div className="flex gap-2">
                    {selected.status === 'scheduled' && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          onCancel(selected)
                          setSelected(null)
                        }}
                        className="text-destructive"
                      >
                        <X className="w-4 h-4 mr-1" /> Cancelar
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {isClinic && onScheduleReturn && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          onScheduleReturn(selected)
                          setSelected(null)
                        }}
                      >
                        <CalendarPlus className="w-4 h-4 mr-1" /> Agendar retorno
                      </Button>
                    )}
                    {/* Nicho Clínicas usa só a progressão de status clínico (acima) —
                        ela já termina em "Realizado" e dispara o Atendimento +
                        lançamento em Financeiro. O botão genérico "Marcar
                        concluído" ficava como um segundo caminho que marcava
                        completed sem passar por esse fluxo. */}
                    {selected.status === 'scheduled' && !isClinic && (
                      <Button
                        onClick={() => {
                          onComplete(selected)
                          setSelected(null)
                        }}
                      >
                        <Check className="w-4 h-4 mr-1" /> Marcar concluído
                      </Button>
                    )}
                  </div>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!finalizeTarget} onOpenChange={o => !o && setFinalizeTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Finalizar atendimento</DialogTitle>
          </DialogHeader>
          {finalizeTarget && (
            <form onSubmit={submitFinalize} className="space-y-4">
              <p className="text-xs text-muted-foreground">
                {finalizeTarget.guest_name} — deixe em branco pra usar o preço de tabela do procedimento.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Valor cobrado (R$)</Label>
                  <Input
                    type="number" min={0} step="0.01"
                    value={finalizeForm.total}
                    onChange={e => setFinalizeForm(f => ({ ...f, total: e.target.value }))}
                    placeholder="Preço de tabela"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Desconto (R$)</Label>
                  <Input
                    type="number" min={0} step="0.01"
                    value={finalizeForm.discount}
                    onChange={e => setFinalizeForm(f => ({ ...f, discount: e.target.value }))}
                    placeholder="0,00"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Forma de pagamento</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-input/25 px-3 text-sm"
                    value={finalizeForm.paymentMethod}
                    onChange={e => setFinalizeForm(f => ({ ...f, paymentMethod: e.target.value }))}
                  >
                    <option value="">(Não informado)</option>
                    {Object.entries(PAYMENT_METHOD_LABEL).map(([k, l]) => (
                      <option key={k} value={k}>{l}</option>
                    ))}
                  </select>
                </div>
                {finalizeForm.paymentMethod === 'credito' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Parcelas</Label>
                    <Input
                      type="number" min={1} max={24} step={1}
                      value={finalizeForm.installments}
                      onChange={e => setFinalizeForm(f => ({ ...f, installments: e.target.value }))}
                      placeholder="1"
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button type="submit">
                  <Check className="w-4 h-4 mr-1" /> Finalizar
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
