'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ResponsiveSelect } from '@/components/ui/responsive-select'
import { updateVoiceAccountSettings, type VoiceLimits } from '@/actions/voice'

const RECORDING_OPTIONS = [
  { value: 'off', label: 'Desligada' },
  { value: 'always', label: 'Sempre gravar' },
  { value: 'team', label: 'Somente equipes específicas' },
  { value: 'ai_only', label: 'Somente Voice AI' },
]

export function VoiceSettingsForm({ orgSlug, initialRecordingPolicy, initialLimits }: {
  orgSlug: string
  initialRecordingPolicy: string
  initialLimits: VoiceLimits
}) {
  const [recordingPolicy, setRecordingPolicy] = useState(initialRecordingPolicy)
  const [limits, setLimits] = useState<VoiceLimits>(initialLimits)
  const [pending, startTransition] = useTransition()

  function toCents(v: string): number | null {
    const n = Number(v.replace(',', '.'))
    return isNaN(n) || n <= 0 ? null : Math.round(n * 100)
  }
  function fromCents(v: number | null | undefined): string {
    return v ? (v / 100).toString() : ''
  }

  function handleSave() {
    startTransition(async () => {
      const res = await updateVoiceAccountSettings(orgSlug, { recordingPolicy, limits })
      if (!res.ok) { toast.error(res.error); return }
      toast.success('Configurações salvas.')
    })
  }

  return (
    <div className="space-y-4 max-w-xl">
      <Card>
        <CardHeader><CardTitle className="text-sm">Gravações</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveSelect
            className="w-full"
            value={recordingPolicy}
            onValueChange={setRecordingPolicy}
            options={RECORDING_OPTIONS}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Limites de segurança</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-xs text-muted-foreground">
              Limite diário (R$)
              <Input inputMode="decimal" value={fromCents(limits.daily_cents)} onChange={e => setLimits(l => ({ ...l, daily_cents: toCents(e.target.value) }))} placeholder="Sem limite" />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              Limite mensal (R$)
              <Input inputMode="decimal" value={fromCents(limits.monthly_cents)} onChange={e => setLimits(l => ({ ...l, monthly_cents: toCents(e.target.value) }))} placeholder="Sem limite" />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              Limite por chamada (R$)
              <Input inputMode="decimal" value={fromCents(limits.per_call_cents)} onChange={e => setLimits(l => ({ ...l, per_call_cents: toCents(e.target.value) }))} placeholder="Sem limite" />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              Limite para automações (R$)
              <Input inputMode="decimal" value={fromCents(limits.automation_max_cents)} onChange={e => setLimits(l => ({ ...l, automation_max_cents: toCents(e.target.value) }))} placeholder="Sem limite" />
            </label>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={pending}>{pending ? 'Salvando...' : 'Salvar configurações'}</Button>
    </div>
  )
}
