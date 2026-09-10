'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ResponsiveSelect } from '@/components/ui/responsive-select'
import { setMyVoicePresence } from '@/actions/voice'

const STATUS_META: Record<string, { label: string; dot: string }> = {
  online: { label: 'Online', dot: 'bg-green-500' },
  busy: { label: 'Ocupado', dot: 'bg-amber-500' },
  dnd: { label: 'Não perturbe', dot: 'bg-red-500' },
  offline: { label: 'Offline', dot: 'bg-muted-foreground/40' },
}

interface TeamMember { userId: string; name: string; status: string; inCall: boolean; callsToday: number }

export function VoiceTeamClient({ orgSlug, currentUserId, team }: { orgSlug: string; currentUserId: string; team: TeamMember[] }) {
  const [pending, startTransition] = useTransition()
  const me = team.find(m => m.userId === currentUserId)

  function handleChange(status: string) {
    startTransition(async () => {
      const res = await setMyVoicePresence(orgSlug, status as any)
      if (!res.ok) toast.error(res.error)
    })
  }

  return (
    <div className="space-y-4">
      {me && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Meu status:</span>
          <ResponsiveSelect
            className="w-44"
            value={me.status}
            onValueChange={handleChange}
            options={Object.entries(STATUS_META).map(([value, m]) => ({ value, label: m.label }))}
          />
          {pending && <span className="text-xs text-muted-foreground">salvando...</span>}
        </div>
      )}

      <div className="rounded-none border divide-y">
        {team.map(m => {
          const meta = STATUS_META[m.status] || STATUS_META.offline
          return (
            <div key={m.userId} className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                <span className="text-sm font-medium">{m.name}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {m.inCall ? 'Em ligação' : meta.label} · {m.callsToday} ligações hoje
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
