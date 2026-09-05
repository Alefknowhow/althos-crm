'use client'

import { useMemo, useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Mail, Phone, User } from 'lucide-react'
import type { ClinicAppointmentContext } from '@/actions/clinic'
import { CLINIC_STATUS_LABEL, CLINIC_STATUS_COLOR, CLINIC_STAGE_LEGEND, type ClinicStatus } from '@/lib/clinic-constants'
import type { CalendarAppointment, ClinicOption } from './AppointmentsCalendarShared'
import {
  sameDay,
  fmtTime,
  statusOpacity,
  computeOverlapLayout,
  overlapStyle,
  pickFirst,
  HOUR_HEIGHT_PX,
} from './AppointmentsCalendarShared'

/* -------- Day view (agenda do dia, uma coluna por profissional) -------- */

const UNASSIGNED_COL = '__unassigned__'

export function DayProfessionalView({
  day,
  appointments,
  professionals,
  clinicSpecialties = [],
  contexts,
  onSelect,
  hourRange,
  onSlotDoubleClick,
}: {
  day: Date
  appointments: CalendarAppointment[]
  professionals: ClinicOption[]
  clinicSpecialties?: ClinicOption[]
  contexts: Record<string, ClinicAppointmentContext>
  onSelect: (a: CalendarAppointment) => void
  hourRange: { startHour: number; endHour: number }
  onSlotDoubleClick?: (date: Date, time: string, professionalId?: string) => void
}) {
  const [profilePopup, setProfilePopup] = useState<ClinicOption | null>(null)
  const specialtyName = (id: string | null | undefined) => clinicSpecialties.find(s => s.id === id)?.name || null
  const hours = Array.from({ length: hourRange.endHour - hourRange.startHour + 1 }, (_, i) => hourRange.startHour + i)

  // Linha vermelha de "agora" — só no dia de hoje, atualizada a cada minuto
  // (não precisa de mais frequência que isso pra uma linha de horário).
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])
  const isToday = sameDay(now, day)
  const nowHour = now.getHours() + now.getMinutes() / 60
  const nowOffsetPx = isToday && nowHour >= hourRange.startHour && nowHour <= hourRange.endHour + 1
    ? (nowHour - hourRange.startHour) * HOUR_HEIGHT_PX
    : null

  // Agenda do dia só existe pra quem tem agendamento no dia OU está cadastrado
  // ativo — mas colunas vazias (profissional sem nada hoje) ainda aparecem,
  // pra dar visão de disponibilidade. Um bucket "Sem profissional" aparece só
  // se existir algum agendamento do dia sem professional_id (dado legado ou
  // não preenchido), pra não sumir com o agendamento da agenda.
  const dayAppts = useMemo(
    () => appointments.filter(a => a.status !== 'canceled' && sameDay(new Date(a.start_time), day)),
    [appointments, day],
  )
  const hasUnassigned = dayAppts.some(a => !contexts[a.id]?.professional_id)
  const columns = useMemo(
    () => [...professionals, ...(hasUnassigned ? [{ id: UNASSIGNED_COL, name: 'Sem profissional' }] : [])],
    [professionals, hasUnassigned],
  )

  const byColumn = useMemo(() => {
    const map = new Map<string, CalendarAppointment[]>()
    for (const a of dayAppts) {
      const colId = contexts[a.id]?.professional_id || UNASSIGNED_COL
      if (!map.has(colId)) map.set(colId, [])
      map.get(colId)!.push(a)
    }
    return map
  }, [dayAppts, contexts])

  if (columns.length === 0) {
    return (
      <div className="border rounded-lg bg-card py-16 text-center text-sm text-muted-foreground">
        Cadastre profissionais em Profissionais para usar a agenda do dia.
      </div>
    )
  }

  // Largura fixa de coluna (nem espremida com poucos profissionais, nem
  // esticada exageradamente com muitos) — antes era minmax(160px, 1fr), que
  // esticava pra preencher a tela toda com 1-2 profissionais. overflow-x-auto
  // + min-w-max no wrapper já cuidam do scroll lateral quando excede a tela.
  const COLUMN_WIDTH_PX = 220
  const gridCols = `60px repeat(${columns.length}, ${COLUMN_WIDTH_PX}px)`

  return (
    <>
    <div className="space-y-2">
      <div className="flex items-center gap-3 flex-wrap px-0.5 text-[11px] text-muted-foreground">
        {CLINIC_STAGE_LEGEND.map(item => (
          <span key={item.label} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
      <div className="border rounded-lg overflow-x-auto bg-card">
        <div className="min-w-max">
        {/* Column headers */}
        <div className="grid border-b bg-muted/30" style={{ gridTemplateColumns: gridCols }}>
          <div /> {/* gutter */}
          {columns.map(col => {
            const hasProfile = col.id !== UNASSIGNED_COL
            return (
              <div key={col.id} className="px-3 py-2 text-center border-l">
                <div className="flex items-center justify-center gap-1.5 text-sm font-semibold truncate">
                  <button
                    type="button"
                    disabled={!hasProfile}
                    onClick={() => hasProfile && setProfilePopup(col)}
                    title={hasProfile ? 'Ver dados do profissional' : undefined}
                    className={hasProfile ? 'shrink-0 rounded-full hover:ring-2 hover:ring-primary/40 transition-shadow' : 'shrink-0'}
                  >
                    {col.avatar_url ? (
                      <img src={col.avatar_url} alt={col.name} className="w-6 h-6 rounded-full object-cover" />
                    ) : (
                      <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                      </span>
                    )}
                  </button>
                  <span className="truncate">{col.name}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Time grid */}
        <div className="grid relative" style={{ gridTemplateColumns: gridCols }}>
          {isToday && nowOffsetPx != null && (
            <div
              className="absolute left-[60px] right-0 z-20 pointer-events-none flex items-center"
              style={{ top: nowOffsetPx }}
            >
              <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 shrink-0" />
              <div className="flex-1 h-[2px] bg-red-500" />
            </div>
          )}
          <div>
            {hours.map(h => (
              <div
                key={h}
                className="text-[10px] text-muted-foreground text-right pr-2 border-b border-border/60"
                style={{ height: HOUR_HEIGHT_PX }}
              >
                <span className="relative -top-1.5">{String(h).padStart(2, '0')}:00</span>
              </div>
            ))}
          </div>

          {columns.map(col => {
            const appts = byColumn.get(col.id) || []
            const overlapLayout = computeOverlapLayout(appts)
            return (
              <div key={col.id} className="relative border-l" style={{ height: hours.length * HOUR_HEIGHT_PX }}>
                {onSlotDoubleClick ? (
                  hours.map(h => (
                    <div key={h} style={{ height: HOUR_HEIGHT_PX }} className="border-b border-border/60">
                      <button
                        type="button"
                        onDoubleClick={() => onSlotDoubleClick(day, `${String(h).padStart(2, '0')}:00`, col.id === UNASSIGNED_COL ? undefined : col.id)}
                        title="Duplo clique para criar um agendamento"
                        className="block w-full text-left hover:bg-primary/5 border-b border-border/20"
                        style={{ height: HOUR_HEIGHT_PX / 2 }}
                      />
                      <button
                        type="button"
                        onDoubleClick={() => onSlotDoubleClick(day, `${String(h).padStart(2, '0')}:30`, col.id === UNASSIGNED_COL ? undefined : col.id)}
                        title="Duplo clique para criar um agendamento"
                        className="block w-full text-left hover:bg-primary/5"
                        style={{ height: HOUR_HEIGHT_PX / 2 }}
                      />
                    </div>
                  ))
                ) : (
                  hours.map(h => (
                    <div key={h} className="border-b border-border/60" style={{ height: HOUR_HEIGHT_PX }}>
                      <div className="border-b border-border/20" style={{ height: HOUR_HEIGHT_PX / 2 }} />
                    </div>
                  ))
                )}

                {appts.map(a => {
                  const start = new Date(a.start_time)
                  const end = new Date(a.end_time)
                  const startHour = start.getHours() + start.getMinutes() / 60
                  const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)

                  const visibleTop = Math.max(0, startHour - hourRange.startHour) * HOUR_HEIGHT_PX
                  const visibleHeight = Math.max(22, durationHours * HOUR_HEIGHT_PX - 2)

                  if (startHour >= hourRange.endHour + 1) return null
                  if (startHour + durationHours <= hourRange.startHour) return null

                  const et = pickFirst(a.event_types)
                  const clinicStatus = contexts[a.id]?.clinic_status as ClinicStatus | undefined
                  // Cor por estágio do agendamento (chegou? em atendimento?
                  // finalizado? cancelado?) — não mais pelo procedimento, que
                  // já é identificado pelo nome no texto do card. Ver legenda
                  // no cabeçalho da agenda (CLINIC_STAGE_LEGEND).
                  const color = CLINIC_STATUS_COLOR[clinicStatus || 'agendado']
                  const slot = overlapLayout.get(a.id) || { col: 0, cols: 1 }
                  const layout: 'tiny' | 'short' | 'tall' =
                    visibleHeight < 32 ? 'tiny' : visibleHeight < 56 ? 'short' : 'tall'
                  const paddingCls = layout === 'tiny' ? 'px-1.5 py-0.5' : 'p-1.5'
                  const textCls = layout === 'tiny' ? 'text-[10px]' : 'text-[11px]'

                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => onSelect(a)}
                      className={`absolute rounded text-left leading-tight overflow-hidden border hover:z-10 transition-shadow ${paddingCls} ${textCls} ${statusOpacity(a.status)}`}
                      style={{
                        top: visibleTop,
                        height: visibleHeight,
                        ...overlapStyle(slot),
                        backgroundColor: `${color}22`,
                        borderLeft: `3px solid ${color}`,
                      }}
                      title={`${a.guest_name} — ${et?.name || ''} (${fmtTime(a.start_time)} - ${fmtTime(a.end_time)}) — ${CLINIC_STATUS_LABEL[clinicStatus || 'agendado']}`}
                    >
                      {layout === 'tiny' ? (
                        <div className="flex items-baseline gap-1 truncate">
                          <span className="text-muted-foreground tabular-nums shrink-0">{fmtTime(a.start_time)}</span>
                          <span className="font-semibold truncate">{a.guest_name}</span>
                        </div>
                      ) : layout === 'short' ? (
                        <>
                          <div className="font-semibold truncate">{a.guest_name}</div>
                          <div className="text-muted-foreground truncate">{et?.name || ''}</div>
                        </>
                      ) : (
                        <>
                          <div className="font-semibold truncate">{a.guest_name}</div>
                          <div className="text-muted-foreground truncate">{et?.name || ''}</div>
                          <div className="text-muted-foreground tabular-nums">{fmtTime(a.start_time)}</div>
                        </>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
      </div>
    </div>

    <Dialog open={!!profilePopup} onOpenChange={o => !o && setProfilePopup(null)}>
      <DialogContent className="max-w-sm">
        {profilePopup && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                {profilePopup.avatar_url ? (
                  <img src={profilePopup.avatar_url} alt={profilePopup.name} className="w-14 h-14 rounded-full object-cover" />
                ) : (
                  <span className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                    <User className="w-6 h-6 text-muted-foreground" />
                  </span>
                )}
                <div>
                  <DialogTitle>{profilePopup.name}</DialogTitle>
                  {specialtyName(profilePopup.specialty_id) && (
                    <p className="text-sm text-muted-foreground">{specialtyName(profilePopup.specialty_id)}</p>
                  )}
                </div>
              </div>
            </DialogHeader>
            <div className="space-y-2 text-sm">
              {profilePopup.registration_no && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="font-medium text-foreground">Registro:</span> {profilePopup.registration_no}
                </div>
              )}
              {profilePopup.commission_pct != null && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="font-medium text-foreground">Comissão:</span> {profilePopup.commission_pct}%
                </div>
              )}
              {profilePopup.phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="w-3.5 h-3.5" /> {profilePopup.phone}
                </div>
              )}
              {profilePopup.email && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="w-3.5 h-3.5" /> {profilePopup.email}
                </div>
              )}
              {!profilePopup.registration_no && profilePopup.commission_pct == null && !profilePopup.phone && !profilePopup.email && (
                <p className="text-muted-foreground">Sem dados adicionais cadastrados.</p>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
    </>
  )
}
