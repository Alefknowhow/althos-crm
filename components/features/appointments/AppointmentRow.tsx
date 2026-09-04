'use client'

/**
 * Single table row for the appointments list view. Prop-driven, split
 * out of AppointmentsListPanel.tsx.
 */

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TableCell, TableRow } from '@/components/ui/table'
import { ExternalLink, X, Check } from 'lucide-react'
import type { ClinicAppointmentContext } from '@/actions/clinic'
import { CLINIC_STATUSES, CLINIC_STATUS_LABEL, type ClinicStatus } from '@/lib/clinic-constants'
import type { CalendarAppointment } from './AppointmentsCalendar'

type Appointment = CalendarAppointment

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

export function AppointmentRow({
  orgSlug,
  appt,
  onCancel,
  onComplete,
  loading,
  isClinic,
  clinicContext,
  professionalName,
  onClinicStatusChange,
}: {
  orgSlug: string
  appt: Appointment
  onCancel: (a: Appointment) => void
  onComplete: (a: Appointment) => void
  loading: boolean
  isClinic?: boolean
  clinicContext?: ClinicAppointmentContext
  professionalName?: string | null
  onClinicStatusChange?: (appt: Appointment, status: ClinicStatus) => void
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
            <div className="text-xs text-muted-foreground">
              {et?.duration_minutes} min{professionalName ? ` · ${professionalName}` : ''}
            </div>
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
        {isClinic && (
          <select
            className="mt-1 block h-6 rounded border border-input bg-input/25 px-1 text-[10px]"
            value={clinicContext?.clinic_status || 'agendado'}
            onChange={e => onClinicStatusChange?.(appt, e.target.value as ClinicStatus)}
          >
            {CLINIC_STATUSES.map(s => (
              <option key={s} value={s}>{CLINIC_STATUS_LABEL[s]}</option>
            ))}
          </select>
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
            {/* Nicho Clínicas usa o select de status clínico acima (que já
                termina em "Realizado" e gera Atendimento + Financeiro) — o
                atalho genérico de concluir ficava como um segundo caminho
                que não passava por esse fluxo. */}
            {!isClinic && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onComplete(appt)}
                disabled={loading}
                title="Marcar como concluído"
              >
                <Check className="w-3.5 h-3.5 text-green-600" />
              </Button>
            )}
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
