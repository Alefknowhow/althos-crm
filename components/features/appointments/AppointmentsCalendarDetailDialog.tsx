import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { X, Check, MapPin, Mail, Phone, ExternalLink, CalendarPlus, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import type { ClinicAppointmentContext } from '@/actions/clinic'
import { CLINIC_STATUS_LABEL, type ClinicStatus } from '@/lib/clinic-constants'
import { pickFirst } from './AppointmentsCalendarShared'
import type { CalendarAppointment, ClinicFinalizePayment } from './AppointmentsCalendarShared'

// Popup de detalhe de um agendamento selecionado (Semana/Mês/Dia) —
// extraído de AppointmentsCalendar.tsx. Pura movimentação de JSX.

const NEXT_CLINIC_STATUS: Partial<Record<ClinicStatus, ClinicStatus>> = {
  aguardando_confirmacao: 'confirmado',
  agendado: 'confirmado',
  confirmado: 'em_atendimento',
  em_atendimento: 'realizado',
}

const NEXT_ACTION_LABEL: Partial<Record<ClinicStatus, string>> = {
  confirmado: 'Confirmar',
  em_atendimento: 'Paciente chegou',
  realizado: 'Finalizar atendimento',
}

export function AppointmentsCalendarDetailDialog({
  orgSlug, selected, setSelected, clinicContexts, isClinic, onCancel, onComplete,
  onClinicStatusChange, onScheduleReturn, openFinalizeDialog,
}: {
  orgSlug: string
  selected: CalendarAppointment | null
  setSelected: (a: CalendarAppointment | null) => void
  clinicContexts: Record<string, ClinicAppointmentContext>
  isClinic: boolean
  onCancel: (a: CalendarAppointment) => void
  onComplete: (a: CalendarAppointment) => void
  onClinicStatusChange?: (a: CalendarAppointment, status: ClinicStatus, payment?: ClinicFinalizePayment) => void
  onScheduleReturn?: (a: CalendarAppointment) => void
  openFinalizeDialog: (a: CalendarAppointment) => void
}) {
  const selectedEt = selected ? pickFirst(selected.event_types) : null
  const selectedLead = selected ? pickFirst(selected.leads) : null

  return (
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
  )
}
