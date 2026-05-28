'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Trash2 } from 'lucide-react'
import { setAvailability } from '@/actions/appointments'

type Availability = {
  id: string
  day_of_week: number
  start_time: string
  end_time: string
  event_type_id: string | null
}

type EventType = { id: string; name: string }

type Props = {
  orgSlug: string
  eventTypes: EventType[]
  initialAvailabilities: Availability[]
}

const DAYS = [
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
] as const

type Slot = { id: string; day_of_week: number; start_time: string; end_time: string }

function normalizeTime(t: string): string {
  // Postgres returns TIME as "HH:MM:SS"; HTML input expects "HH:MM".
  if (!t) return t
  return t.length >= 5 ? t.slice(0, 5) : t
}

export default function AvailabilityPanel({ orgSlug, eventTypes, initialAvailabilities }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  // Scope = "" means org-wide; otherwise event-type-specific. Org-wide acts as
  // the fallback when a given event type has no slots defined.
  const [scope, setScope] = useState<string>('')
  const [saving, setSaving] = useState(false)

  // Always derive editable rows from the initial data + scope filter so a
  // scope switch resets the dirty draft (clearer UX than carrying stale state).
  const [slots, setSlots] = useState<Slot[]>(() =>
    initialAvailabilities
      .filter(a => (scope ? a.event_type_id === scope : a.event_type_id === null))
      .map(a => ({
        id: a.id,
        day_of_week: a.day_of_week,
        start_time: normalizeTime(a.start_time),
        end_time: normalizeTime(a.end_time),
      })),
  )

  function changeScope(newScope: string) {
    setScope(newScope)
    setSlots(
      initialAvailabilities
        .filter(a => (newScope ? a.event_type_id === newScope : a.event_type_id === null))
        .map(a => ({
          id: a.id,
          day_of_week: a.day_of_week,
          start_time: normalizeTime(a.start_time),
          end_time: normalizeTime(a.end_time),
        })),
    )
  }

  function addSlot(day: number) {
    setSlots(s => [
      ...s,
      { id: `tmp-${Date.now()}-${Math.random()}`, day_of_week: day, start_time: '09:00', end_time: '17:00' },
    ])
  }

  function updateSlot(id: string, patch: Partial<Slot>) {
    setSlots(s => s.map(x => (x.id === id ? { ...x, ...patch } : x)))
  }

  function removeSlot(id: string) {
    setSlots(s => s.filter(x => x.id !== id))
  }

  async function save() {
    // Validate windows.
    for (const s of slots) {
      if (s.start_time >= s.end_time) {
        toast.error('Início precisa ser antes do fim')
        return
      }
    }
    setSaving(true)
    const res = await setAvailability(
      orgSlug,
      slots.map(s => ({
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time,
      })),
      scope || null,
    )
    setSaving(false)
    if (res.ok) {
      toast.success('Horários salvos')
      startTransition(() => router.refresh())
    } else {
      toast.error(res.error)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle>Horários disponíveis</CardTitle>
            <CardDescription>
              Janelas semanais nas quais o cliente pode marcar. Os slots concretos são gerados a partir da
              duração de cada tipo de evento.
            </CardDescription>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Aplicar para</Label>
            <select
              className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm min-w-[220px]"
              value={scope}
              onChange={e => changeScope(e.target.value)}
            >
              <option value="">Todos os eventos (padrão da org)</option>
              {eventTypes.map(et => (
                <option key={et.id} value={et.id}>
                  Específico: {et.name}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-muted-foreground max-w-[220px]">
              Sem específico, usa o padrão da org. Específico sobrescreve o padrão para aquele evento.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {DAYS.map(d => {
            const daySlots = slots.filter(s => s.day_of_week === d.value)
            return (
              <div key={d.value} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{d.label}</span>
                  <Button variant="ghost" size="sm" onClick={() => addSlot(d.value)}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar janela
                  </Button>
                </div>

                {daySlots.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sem disponibilidade nesse dia.</p>
                ) : (
                  <div className="space-y-2">
                    {daySlots.map(s => (
                      <div key={s.id} className="flex items-center gap-2">
                        <Input
                          type="time"
                          value={s.start_time}
                          onChange={e => updateSlot(s.id, { start_time: e.target.value })}
                          className="w-32"
                        />
                        <span className="text-muted-foreground text-sm">até</span>
                        <Input
                          type="time"
                          value={s.end_time}
                          onChange={e => updateSlot(s.id, { end_time: e.target.value })}
                          className="w-32"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSlot(s.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={save} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar horários'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
