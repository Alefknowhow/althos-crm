'use client'

import { useState, useTransition } from 'react'
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

type EventType = {
  id: string
  name: string
  duration_minutes: number
  color: string | null
}

type Props = {
  orgSlug: string
  eventTypes: EventType[]
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

export default function NewAppointmentDialog({ orgSlug, eventTypes }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
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
  })

  function onEventTypeChange(id: string) {
    const et = eventTypes.find(e => e.id === id)
    setForm(f => ({
      ...f,
      eventTypeId: id,
      duration: f.customDuration ? f.duration : et?.duration_minutes || 30,
    }))
  }

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
    setSaving(false)

    if (res.ok) {
      toast.success('Agendamento criado')
      setOpen(false)
      // Reset minimal fields; keep eventType pick so a busy operator can chain creations.
      setForm(f => ({ ...f, name: '', email: '', phone: '', notes: '' }))
      startTransition(() => router.refresh())
    } else {
      toast.error(res.error)
    }
  }

  if (eventTypes.length === 0) {
    return (
      <Button disabled title="Crie um tipo de evento antes de marcar agendamentos">
        <Plus className="w-4 h-4 mr-1" /> Novo agendamento
      </Button>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-1" /> Novo agendamento
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo agendamento manual</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de evento *</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
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
            normal. Para o link público (cliente marcando sozinho), use a aba "Tipos de Evento".
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
