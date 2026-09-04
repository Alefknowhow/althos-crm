'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Plus } from 'lucide-react'
import { createManualAppointment } from '@/actions/appointments'
import { upsertClinicAppointmentContext, type ClinicServiceContext } from '@/actions/clinic'
import { traduzirErro } from '@/lib/utils/error-translator'
import { NewAppointmentDialogClinicFields } from './NewAppointmentDialogClinicFields'

type EventType = {
  id: string
  name: string
  duration_minutes: number
  color: string | null
}

type ClinicOption = { id: string; name: string }

export type AppointmentPrefill = {
  date?: string // YYYY-MM-DD
  time?: string // HH:MM
  professionalId?: string | null
  guestName?: string
  guestEmail?: string
  guestPhone?: string | null
}

type Props = {
  orgSlug: string
  eventTypes: EventType[]
  /** true só pra orgs do nicho Clínicas — habilita os campos de
   *  profissional/sala no agendamento manual. */
  isClinic?: boolean
  clinicProfessionals?: ClinicOption[]
  clinicRooms?: ClinicOption[]
  /** Contexto clínico por event_type_id — usado pra restringir o select de
   *  profissional ao procedimento escolhido (quando o procedimento tem um
   *  profissional exclusivo cadastrado). */
  clinicServiceContexts?: Record<string, ClinicServiceContext>
  /** Modo controlado — usado pelo duplo clique no calendário e por "Agendar
   *  retorno" no popup de detalhe, que abrem o diálogo programaticamente
   *  (sem o botão "+ Novo agendamento") já com data/hora/paciente
   *  preenchidos. Sem esses props, o componente funciona como antes
   *  (botão próprio, estado interno). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  prefill?: AppointmentPrefill | null
  hideTrigger?: boolean
}

function todayLocal(): string {
  // Default the date field to today in the browser's local time so the user
  // doesn't have to scroll the picker. The input is YYYY-MM-DD.
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function NewAppointmentDialog({
  orgSlug, eventTypes, isClinic = false, clinicProfessionals = [], clinicRooms = [], clinicServiceContexts = {},
  open: openProp, onOpenChange: onOpenChangeProp, prefill, hideTrigger = false,
}: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [openState, setOpenState] = useState(false)
  const isControlled = openProp !== undefined
  const open = isControlled ? openProp : openState
  const setOpen = isControlled ? (onOpenChangeProp || (() => {})) : setOpenState
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    eventTypeId: eventTypes[0]?.id || '',
    date: todayLocal(),
    time: '09:00',
    duration: eventTypes[0]?.duration_minutes || 30,
    customDuration: false,
    name: '',
    email: '',
    phone: '',
    notes: '',
    professionalId: '',
    roomId: '',
  })

  // Modo controlado: toda vez que o diálogo abre com um prefill novo (duplo
  // clique num horário, ou "Agendar retorno" a partir de um agendamento
  // existente), reseta o form com os valores certos em vez de manter o que
  // sobrou da última abertura.
  useEffect(() => {
    if (!open || !prefill) return
    setForm(f => ({
      ...f,
      date: prefill.date ?? f.date,
      time: prefill.time ?? f.time,
      professionalId: prefill.professionalId ?? f.professionalId,
      name: prefill.guestName ?? f.name,
      email: prefill.guestEmail ?? f.email,
      phone: prefill.guestPhone ?? f.phone,
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prefill])

  function onEventTypeChange(id: string) {
    const et = eventTypes.find(e => e.id === id)
    // Procedimento com profissional exclusivo já vem pré-selecionado; se o
    // procedimento anterior tinha um profissional fixo diferente, troca —
    // sem isso o form podia ficar com um profissional que não faz aquele
    // procedimento.
    const restrictedProfessionalId = clinicServiceContexts[id]?.professional_id || ''
    setForm(f => ({
      ...f,
      eventTypeId: id,
      duration: f.customDuration ? f.duration : et?.duration_minutes || 30,
      professionalId: restrictedProfessionalId || f.professionalId,
    }))
  }

  // Profissional exclusivo do procedimento escolhido (se houver) — restringe
  // o select a só ele; sem procedimento restrito, mostra todos.
  const restrictedProfessionalId = clinicServiceContexts[form.eventTypeId]?.professional_id || null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.eventTypeId) {
      toast.error('Selecione um tipo de evento')
      return
    }
    // Compose local datetime, then build ISO. Local TZ is fine because the
    // server stores TIMESTAMPTZ and JS .toISOString() converts to UTC.
    const startLocal = new Date(`${form.date}T${form.time}:00`)
    if (isNaN(startLocal.getTime())) {
      toast.error('Data ou hora inválida')
      return
    }

    setSaving(true)
    const res = await createManualAppointment(orgSlug, {
      eventTypeId: form.eventTypeId,
      startTime: startLocal.toISOString(),
      durationMinutes: form.customDuration ? form.duration : undefined,
      guestName: form.name,
      guestEmail: form.email,
      guestPhone: form.phone || null,
      notes: form.notes || null,
    })
    if (res.ok && isClinic && (form.professionalId || form.roomId)) {
      await upsertClinicAppointmentContext(orgSlug, res.appointmentId, {
        professional_id: form.professionalId || null,
        room_id: form.roomId || null,
      })
    }
    setSaving(false)

    if (res.ok) {
      toast.success('Agendamento criado')
      setOpen(false)
      // Reset minimal fields; keep eventType pick so a busy operator can chain creations.
      setForm(f => ({ ...f, name: '', email: '', phone: '', notes: '', professionalId: '', roomId: '' }))
      startTransition(() => router.refresh())
    } else {
      toast.error(traduzirErro(res.error, 'Erro ao criar agendamento'))
    }
  }

  if (eventTypes.length === 0 && !hideTrigger) {
    return (
      <Button disabled title="Crie um tipo de evento antes de marcar agendamentos">
        <Plus className="w-4 h-4 mr-1" /> Novo agendamento
      </Button>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button>
            <Plus className="w-4 h-4 mr-1" /> Novo agendamento
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo agendamento manual</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de evento *</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-input/25 px-3 text-sm"
              value={form.eventTypeId}
              onChange={e => onEventTypeChange(e.target.value)}
              required
            >
              {eventTypes.map(et => (
                <option key={et.id} value={et.id}>
                  {et.name} · {et.duration_minutes} min
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data *</Label>
              <Input
                type="date"
                value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Hora *</Label>
              <Input
                type="time"
                value={form.time}
                onChange={e => setForm({ ...form, time: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={form.customDuration}
                onChange={e => setForm({ ...form, customDuration: e.target.checked })}
              />
              Sobrescrever duração padrão
            </label>
            {form.customDuration && (
              <Input
                type="number"
                min={5}
                max={480}
                value={form.duration}
                onChange={e => setForm({ ...form, duration: Number(e.target.value) })}
              />
            )}
          </div>

          <div className="space-y-2">
            <Label>Nome do cliente *</Label>
            <Input
              required
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>E-mail *</Label>
              <Input
                type="email"
                required
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
              />
            </div>
          </div>

          {isClinic && (
            <NewAppointmentDialogClinicFields
              clinicProfessionals={clinicProfessionals}
              clinicRooms={clinicRooms}
              professionalId={form.professionalId}
              roomId={form.roomId}
              restrictedProfessionalId={restrictedProfessionalId}
              onProfessionalChange={id => setForm({ ...form, professionalId: id })}
              onRoomChange={id => setForm({ ...form, roomId: id })}
            />
          )}

          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="Contexto, motivo..."
            />
          </div>

          <p className="text-xs text-muted-foreground border-t pt-3">
            Agendamento manual não valida horário disponível — o operador pode marcar fora da agenda
            normal. Para o link público (cliente marcando sozinho), use a aba &quot;Tipos de Evento&quot;.
          </p>

          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Criar agendamento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
