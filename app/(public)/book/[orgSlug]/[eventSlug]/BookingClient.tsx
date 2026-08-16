'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { HONEYPOT_FIELD_NAME } from '@/lib/security/antispam-constants'
import { Calendar } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Clock, MapPin, Check, ChevronLeft } from 'lucide-react'
import { getAvailableSlots, createPublicAppointment } from '@/actions/appointments'

type EventType = {
  id: string
  name: string
  slug: string
  description: string | null
  duration_minutes: number
  location: string | null
  color: string | null
}

type Props = {
  orgSlug: string
  orgName: string
  eventSlug: string
  eventType: EventType
}

function ymd(d: Date): string {
  // YYYY-MM-DD in local time so the user's chosen calendar date stays
  // unambiguous when we ask the server for slots.
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })
}

function formatDateLong(d: Date): string {
  return d.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })
}

export default function BookingClient({ orgSlug, orgName, eventSlug, eventType }: Props) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [slots, setSlots] = useState<string[]>([])
  const [loadingSlots, startLoadingSlots] = useTransition()
  const [step, setStep] = useState<'pick' | 'form' | 'done'>('pick')

  const [form, setForm] = useState({ name: '', email: '', phone: '', notes: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<{ when: string } | null>(null)
  // Anti-spam: captured on mount, sent on submit.
  const mountedAtRef = useRef<number>(Date.now())
  const honeypotRef = useRef<HTMLInputElement | null>(null)

  // Fetch slots whenever the date changes. Server action does the heavy lifting
  // (availabilities + existing appointments + duration math).
  useEffect(() => {
    if (!selectedDate) {
      setSlots([])
      return
    }
    setSelectedSlot(null)
    startLoadingSlots(async () => {
      const res = await getAvailableSlots(orgSlug, eventSlug, ymd(selectedDate))
      setSlots(res.slots)
    })
  }, [selectedDate, orgSlug, eventSlug])

  function pickSlot(iso: string) {
    setSelectedSlot(iso)
    setStep('form')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedSlot) return
    setSubmitting(true)
    setError(null)
    const res = await createPublicAppointment({
      orgSlug,
      eventSlug,
      startTime: selectedSlot,
      guestName: form.name,
      guestEmail: form.email,
      guestPhone: form.phone || null,
      notes: form.notes || null,
      // Anti-spam tokens — read on the server by runAntispamGauntlet.
      honeypot: honeypotRef.current?.value || '',
      formMountedAt: mountedAtRef.current,
      turnstileToken:
        (document.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement | null)
          ?.value || null,
    })
    setSubmitting(false)
    if (res.ok) {
      const d = new Date(selectedSlot)
      setConfirmation({
        when: `${formatDateLong(d)} às ${formatTime(selectedSlot)}`,
      })
      setStep('done')
    } else {
      setError(res.error || 'Erro ao confirmar')
    }
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-card border rounded-none   p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center mx-auto mb-4">
            <Check className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">Agendamento confirmado!</h1>
          <p className="text-muted-foreground text-sm mb-6">
            Você marcou <strong>{eventType.name}</strong> com {orgName}.
          </p>
          <div className="border rounded-lg p-4 bg-muted/30 space-y-2 text-sm">
            <div className="flex items-center justify-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <strong>{confirmation?.when}</strong>
            </div>
            {eventType.location && (
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <MapPin className="w-4 h-4" />
                {eventType.location}
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-6">
            Enviamos os detalhes para {form.email}. Se precisar remarcar, é só responder ao e-mail.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-4xl bg-card border rounded-none   overflow-hidden flex flex-col md:flex-row">
        {/* Sidebar — event info */}
        <div className="w-full md:w-1/3 bg-muted/30 p-8 border-b md:border-b-0 md:border-r border-border">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {orgName}
          </h2>
          <h1 className="text-2xl font-bold mt-2 tracking-tight">{eventType.name}</h1>
          {eventType.description && (
            <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
              {eventType.description}
            </p>
          )}
          <div className="space-y-2 mt-6 text-sm">
            <div className="flex items-center gap-2 text-foreground">
              <Clock className="w-4 h-4 text-muted-foreground" />
              {eventType.duration_minutes} minutos
            </div>
            {eventType.location && (
              <div className="flex items-center gap-2 text-foreground">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span className="break-words">{eventType.location}</span>
              </div>
            )}
            {selectedSlot && (
              <div className="border-t pt-3 mt-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  Seu horário
                </div>
                <div className="font-medium">
                  {formatDateLong(new Date(selectedSlot))} · {formatTime(selectedSlot)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="w-full md:w-2/3 p-8">
          {step === 'pick' && (
            <>
              <h3 className="text-lg font-medium mb-6">Selecione uma data e horário</h3>
              <div className="flex flex-col md:flex-row gap-8">
                <div>
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={d => d < new Date(new Date().toDateString())}
                    className="border rounded-md"
                  />
                </div>

                <div className="flex-1 min-h-[200px]">
                  {!selectedDate ? (
                    <p className="text-sm text-muted-foreground">
                      Escolha uma data para ver os horários.
                    </p>
                  ) : loadingSlots ? (
                    <p className="text-sm text-muted-foreground">Carregando horários...</p>
                  ) : slots.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhum horário disponível nesse dia. Tente outra data.
                    </p>
                  ) : (
                    <>
                      <p className="text-sm font-medium mb-4">
                        {formatDateLong(selectedDate)}
                      </p>
                      <div className="grid grid-cols-1 gap-2 max-h-[360px] overflow-y-auto pr-1">
                        {slots.map(iso => (
                          <button
                            key={iso}
                            type="button"
                            onClick={() => pickSlot(iso)}
                            className="py-2.5 px-4 text-sm font-medium border border-border rounded-lg hover:border-primary hover:text-primary transition-colors text-center"
                          >
                            {formatTime(iso)}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}

          {step === 'form' && selectedSlot && (
            <form onSubmit={submit} className="space-y-4">
              {/* Honeypot — off-screen, bots fill it; humans never see it. */}
              <div
                aria-hidden="true"
                style={{ position: 'absolute', left: '-10000px', top: 'auto', width: 1, height: 1, overflow: 'hidden' }}
              >
                <label>
                  Company email (deixe em branco)
                  <input
                    ref={honeypotRef}
                    type="text"
                    name={HONEYPOT_FIELD_NAME}
                    tabIndex={-1}
                    autoComplete="off"
                    defaultValue=""
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={() => setStep('pick')}
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Voltar
              </button>

              <h3 className="text-lg font-medium">Seus dados</h3>

              {error && (
                <div className="text-sm text-destructive p-3 bg-destructive/10 rounded-md">{error}</div>
              )}

              <div className="space-y-2">
                <Label>Nome completo *</Label>
                <Input
                  required
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  autoFocus
                />
              </div>

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
                <Label>Telefone / WhatsApp</Label>
                <Input
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  placeholder="(47) 99999-9999"
                />
              </div>

              <div className="space-y-2">
                <Label>Algo a adicionar?</Label>
                <Textarea
                  rows={3}
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Contexto, dúvida específica, link..."
                />
              </div>

              <div className="pt-2 flex justify-end">
                <Button type="submit" size="lg" disabled={submitting}>
                  {submitting ? 'Confirmando...' : 'Confirmar agendamento'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-6">
        Powered by Althos CRM
      </p>
    </div>
  )
}
